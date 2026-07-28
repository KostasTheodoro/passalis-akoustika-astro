/**
 * Reads the built HTML and writes a route-by-route report of everything STEP-09 emits.
 *
 * None of it is visible on the page, so the only way a person can review it is to see it laid out
 * beside itself: fourteen titles with their lengths, fourteen canonicals, and which structured-data
 * types each route carries. A wrong canonical looks exactly like a right one until it is in a
 * column next to thirteen others.
 *
 * Reads `dist/client`, so run `bun run build` first. Writes into `.workflow/`, which is outside the
 * public repository — review artifacts must never land in `artifacts/` in the tree.
 *
 *   bun run scripts/seo-report.ts [--out <path>]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DIST = 'dist/client';
const DEFAULT_OUT = '.workflow/steps/STEP-09-seo-and-discoverability/seo-report.md';

const outFlag = process.argv.indexOf('--out');
const OUT = outFlag === -1 ? DEFAULT_OUT : (process.argv[outFlag + 1] ?? DEFAULT_OUT);

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : path.endsWith('.html') ? [path] : [];
  });
}

/** `dist/client/akoustika/cic/index.html` becomes `/akoustika/cic`. */
function routeOf(file: string): string {
  const rel = relative(DIST, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel === '404.html') return '/404';
  return `/${rel.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function meta(head: string, selector: string, key: 'name' | 'property'): string {
  const match = head.match(new RegExp(`<meta[^>]*${key}="${selector}"[^>]*content="([^"]*)"`, 'i'));
  return match?.[1] ? decode(match[1]) : '';
}

interface Row {
  route: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogImage: string;
  h1: number;
  types: string[];
}

const rows: Row[] = walk(DIST)
  .map((file): Row => {
    const html = readFileSync(file, 'utf8');
    const head = html.split('</head>')[0] ?? '';

    const titleMatch = head.match(/<title>([\s\S]*?)<\/title>/);
    const canonical = head.match(/<link rel="canonical" href="([^"]+)"/);

    const types = [...head.matchAll(/"@type":"([A-Za-z]+)"/g)]
      .map((match) => match[1] as string)
      .filter((type) =>
        [
          'HearingAidStore',
          'WebSite',
          'BreadcrumbList',
          'FAQPage',
          'AboutPage',
          'ContactPage',
        ].includes(type),
      );

    return {
      route: routeOf(file),
      title: titleMatch?.[1] ? decode(titleMatch[1]) : '',
      description: meta(head, 'description', 'name'),
      canonical: canonical?.[1] ?? '',
      robots: meta(head, 'robots', 'name'),
      ogImage: meta(head, 'og:image', 'property'),
      // `<h1` rather than the head, since this one is about the body.
      h1: (html.match(/<h1[\s>]/g) ?? []).length,
      types,
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

const cell = (value: string) => value.replace(/\|/g, '\\|');
const tick = (ok: boolean) => (ok ? 'yes' : '**NO**');

const lines: string[] = [
  '# STEP-09 — rendered SEO report',
  '',
  `Generated from \`${DIST}\` on ${new Date().toISOString().slice(0, 10)} by \`scripts/seo-report.ts\`.`,
  `${rows.length} routes.`,
  '',
  '## Titles and descriptions',
  '',
  'Google shows roughly 60 characters of a title and 160 of a description.',
  '',
  '| Route | Len | Title | Len | Description |',
  '|---|---:|---|---:|---|',
  ...rows.map(
    (row) =>
      `| \`${row.route}\` | ${row.title.length} | ${cell(row.title)} | ${row.description.length} | ${cell(row.description)} |`,
  ),
  '',
  '## Canonicals, robots and structured data',
  '',
  '| Route | Canonical | Robots | h1 | og:image | JSON-LD |',
  '|---|---|---|---:|---|---|',
  ...rows.map(
    (row) =>
      `| \`${row.route}\` | ${row.canonical || '*(none)*'} | ${row.robots} | ${row.h1} | ${row.ogImage ? 'yes' : '**NO**'} | ${row.types.join(', ')} |`,
  ),
  '',
  '## Checks',
  '',
  `- Unique titles: ${tick(new Set(rows.map((r) => r.title)).size === rows.length)}`,
  `- Unique descriptions: ${tick(new Set(rows.map((r) => r.description)).size === rows.length)}`,
  `- Every title under 66 characters: ${tick(rows.every((r) => r.title.length < 66))}`,
  `- Every route names the brand exactly once: ${tick(rows.every((r) => r.title.split('Πασσαλής Ακουστικά').length === 2))}`,
  `- Exactly one h1 per route: ${tick(rows.every((r) => r.h1 === 1))}`,
  `- Every route carries the business and site nodes: ${tick(rows.every((r) => r.types.includes('HearingAidStore') && r.types.includes('WebSite')))}`,
  `- \`/404\` is noindex with no canonical: ${tick(rows.some((r) => r.route === '/404' && r.robots.startsWith('noindex') && r.canonical === ''))}`,
  '',
];

/**
 * Reported rather than asserted. An over-long description is truncated, not broken, and these are
 * the client's own words — shortening one is a copy decision for the maintainer, not the script's.
 */
const longDescriptions = rows.filter((row) => row.description.length > 160);
if (longDescriptions.length > 0) {
  lines.push(
    '### Descriptions Google will truncate',
    '',
    'Not a defect, a judgement call: the tail is cut in the result, so check nothing load-bearing sits there.',
    '',
    ...longDescriptions.map((row) => `- \`${row.route}\` — ${row.description.length} characters`),
    '',
  );
}

writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');

const failures = lines.filter((line) => line.includes('**NO**')).length;
console.log(`Wrote ${OUT} — ${rows.length} routes, ${failures} failing check(s).`);
if (failures > 0) process.exitCode = 1;
