import { join } from 'node:path';

/**
 * The server the browser tests run against.
 *
 * **Why this exists.** Until STEP-08 every route was a static file and `astro preview` served
 * `dist/` happily. Adding `/api/contact` made the build hybrid, and the Vercel adapter has no
 * preview entrypoint: `astro preview` now exits with "does not support the preview command", which
 * would have left the entire browser suite with nothing to run against.
 *
 * The alternatives were worse. `astro dev` is ruled out because Astro detects agent environments
 * and detaches the dev server, leaving the port held and the runner watching a process that has
 * already exited. `vercel dev` needs the Vercel CLI, which is not a dependency of this project.
 *
 * So this serves the real build output: the prerendered HTML from `dist/client`, and the actual
 * bundled function for anything else. That is **more** coverage than `astro preview` gave, because
 * the endpoint is now exercised as it is deployed rather than mocked.
 *
 * Run with `bun run scripts/preview-server.ts --port 4321`.
 */

const CLIENT_ROOT = 'dist/client';
const FUNCTION_ENTRY = '../.vercel/output/functions/_render.func/dist/server/entry.mjs';

const portFlag = process.argv.indexOf('--port');
const port = portFlag === -1 ? 4321 : Number(process.argv[portFlag + 1]);

/**
 * The bundled function, imported lazily.
 *
 * The Vercel adapter emits a web-standard `{ fetch(request) }` handler, which is exactly what Bun's
 * server expects, so nothing has to be adapted between them.
 */
type FetchHandler = { fetch(request: Request): Promise<Response> };

let handler: FetchHandler | null = null;

async function serverHandler(): Promise<FetchHandler | null> {
  if (handler) return handler;

  try {
    const entry = (await import(FUNCTION_ENTRY)) as { default: FetchHandler };
    handler = entry.default;
    return handler;
  } catch {
    // A static-only build has no function. Every route is then a file and that is fine.
    return null;
  }
}

/**
 * Compressible types, and the reason this server bothers.
 *
 * Vercel compresses every text response and sets long cache headers on hashed assets. A preview
 * server that does neither is not a fair place to measure anything: the first Lighthouse run
 * against this page reported "Enable text compression" at 0 and a 2.9s First Contentful Paint,
 * which said more about the harness than about the site.
 *
 * So the two things the platform does for free are done here too, and a performance number
 * measured against this server means something.
 */
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg)/;

/** The candidate files a path could mean, in the order Vercel itself would try them. */
function candidates(pathname: string): string[] {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '').replace(/\/+$/, '');

  if (clean === '') return [join(CLIENT_ROOT, 'index.html')];

  return [
    join(CLIENT_ROOT, clean),
    join(CLIENT_ROOT, `${clean}.html`),
    join(CLIENT_ROOT, clean, 'index.html'),
  ];
}

/**
 * Serves a file the way the platform would: compressed when it is text, and cached hard when its
 * name carries a content hash.
 *
 * `/_astro/` filenames include a hash of their contents, so a year is safe and correct: a changed
 * file is a different URL. Everything else gets `no-cache`, which still allows a conditional
 * request but never serves a stale page.
 */
async function staticResponse(
  request: Request,
  file: Bun.BunFile,
  path: string,
): Promise<Response> {
  const type = file.type || 'application/octet-stream';
  const immutable = path.includes('_astro/');

  const headers = new Headers({
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, no-cache',
  });

  const accepts = request.headers.get('accept-encoding') ?? '';
  if (COMPRESSIBLE.test(type) && accepts.includes('gzip')) {
    const compressed = Bun.gzipSync(new Uint8Array(await file.arrayBuffer()));
    headers.set('content-encoding', 'gzip');
    headers.set('vary', 'accept-encoding');
    return new Response(compressed, { headers });
  }

  return new Response(file, { headers });
}

Bun.serve({
  port,
  idleTimeout: 30,

  async fetch(request) {
    const url = new URL(request.url);

    // Static first, matching production: the CDN answers before the function is ever reached.
    if (request.method === 'GET' || request.method === 'HEAD') {
      for (const candidate of candidates(url.pathname)) {
        const file = Bun.file(candidate);
        if (await file.exists()) {
          // A directory read reports as existing on some platforms; a zero-byte HTML file never
          // does legitimately, so this also guards against serving one.
          if (candidate.endsWith('.html') && file.size === 0) continue;
          return await staticResponse(request, file, candidate);
        }
      }
    }

    const app = await serverHandler();
    if (app) {
      const response = await app.fetch(request);
      // Astro answers unmatched routes with its own 404; prefer the built page so the tests see
      // exactly what a visitor would.
      if (response.status !== 404) return response;
    }

    const notFound = Bun.file(join(CLIENT_ROOT, '404.html'));
    if (await notFound.exists()) {
      return new Response(notFound, { status: 404, headers: { 'content-type': 'text/html' } });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.info(`preview server listening on http://localhost:${port}`);
