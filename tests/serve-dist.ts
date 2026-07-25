/**
 * Minimal static file server for the built site, used only by Playwright.
 *
 * Astro's own `dev` and `preview` commands are unsuitable here: `astro dev`
 * starts its server in a child process and lets the parent exit, so Playwright
 * loses track of it, and `preview` is not supported by the Vercel adapter.
 * Serving `dist/` from a single Bun process keeps startup and teardown
 * predictable, and tests the real build output rather than the dev server.
 */
import { join } from 'node:path';

const distDir = join(import.meta.dir, '..', 'dist');
const port = Number(process.env.PORT ?? 4321);

async function resolveFile(pathname: string) {
  const candidates = [
    join(distDir, pathname),
    join(distDir, pathname, 'index.html'),
    join(distDir, `${pathname}.html`),
  ];

  for (const candidate of candidates) {
    const candidateFile = Bun.file(candidate);
    if (await candidateFile.exists()) {
      return candidateFile;
    }
  }

  return null;
}

Bun.serve({
  port,
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const found = await resolveFile(pathname === '/' ? '/index.html' : pathname);

    if (found) {
      return new Response(found);
    }

    const notFound = Bun.file(join(distDir, '404.html'));
    if (await notFound.exists()) {
      return new Response(notFound, { status: 404 });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`serving ${distDir} on http://localhost:${port}`);
