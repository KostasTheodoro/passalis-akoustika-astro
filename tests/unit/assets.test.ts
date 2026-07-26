import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, posix, relative } from 'node:path';

/**
 * Guardrails for the asset pipeline.
 *
 * Astro validates that a content entry's `image()` path resolves, but only once something
 * renders that entry — and nothing renders yet. These checks stand in for that: they read the
 * files off disk, so a renamed or deleted asset fails here rather than three steps later.
 *
 * They also hold the line on size. The legacy site served a 12.3 MB hero and a 36.2 MB About
 * photo; the budgets below are what keeps that from creeping back.
 */

const ASSETS = 'src/assets/images';
const FONTS = 'src/assets/fonts/sansation';
const BRAND = 'src/assets/brand';
const PUBLIC = 'public';

const KB = 1024;

/** Per-directory ceiling for a single file, in bytes. */
const BUDGETS: Record<string, number> = {
  hero: 800 * KB,
  about: 600 * KB,
  hearing: 200 * KB,
  partners: 150 * KB,
  badges: 50 * KB,
};

/** Everything `public/` is allowed to contain. Anything else belongs in `src/assets/`. */
const PUBLIC_ALLOWLIST = [
  'favicon.svg',
  'favicon.ico',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'og/default.jpg',
];

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const images = walk(ASSETS);
const sourceFiles = [...walk('src'), ...walk('tests')].filter((file) =>
  ['.astro', '.ts', '.tsx', '.md', '.mdx', '.yaml', '.css'].includes(extname(file)),
);
const sourceText = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

describe('image assets', () => {
  test('every image is inside a known group', () => {
    for (const file of images) {
      const group = relative(ASSETS, file).split(/[/\\]/)[0] as string;
      expect(Object.keys(BUDGETS), `${file} is in an unexpected directory`).toContain(group);
    }
  });

  test('no single image exceeds its budget', () => {
    for (const file of images) {
      const group = relative(ASSETS, file).split(/[/\\]/)[0] as string;
      const budget = BUDGETS[group] as number;
      const { size } = statSync(file);

      expect(
        size,
        `${file} is ${Math.round(size / KB)} kB, over its ${budget / KB} kB budget`,
      ).toBeLessThanOrEqual(budget);
    }
  });

  test('the whole image set stays under 4 MB', () => {
    const total = images.reduce((sum, file) => sum + statSync(file).size, 0);
    expect(Math.round(total / KB), 'src/assets/images has grown past 4 MB').toBeLessThanOrEqual(
      4 * KB,
    );
  });

  test('filenames are lowercase, hyphenated and ASCII', () => {
    for (const file of images) {
      const name = relative(ASSETS, file).split(/[/\\]/).pop() as string;
      expect(name, `${file} is not a plain kebab-case name`).toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+$/,
      );
    }
  });

  test('every image is referenced from the source tree', () => {
    // A file nothing points at is dead weight the build still has to carry around.
    for (const file of images) {
      const reference = posix.join(...relative(ASSETS, file).split(/[/\\]/));
      expect(sourceText, `${file} is not referenced anywhere`).toContain(reference);
    }
  });

  test('every image path a content entry declares exists on disk', () => {
    const declared = [...sourceText.matchAll(/\.\.\/\.\.\/assets\/images\/([\w\-/]+\.\w+)/g)].map(
      ([, path]) => path as string,
    );

    expect(declared.length, 'no content entry declares an image').toBeGreaterThan(0);
    for (const path of new Set(declared)) {
      expect(() => statSync(join(ASSETS, path)), `${path} is declared but missing`).not.toThrow();
    }
  });
});

describe('fonts', () => {
  test('only the four faces the site uses are shipped', () => {
    expect(readdirSync(FONTS).sort()).toEqual([
      'Sansation-Bold.woff2',
      'Sansation-BoldItalic.woff2',
      'Sansation-Italic.woff2',
      'Sansation-Regular.woff2',
    ]);
  });

  test('each face is registered in the Astro config', () => {
    const config = readFileSync('astro.config.mjs', 'utf8');
    for (const face of readdirSync(FONTS)) {
      expect(config, `${face} is on disk but not registered`).toContain(face);
    }
  });
});

describe('brand and public files', () => {
  test('the mark and the wordmark are both present as vector', () => {
    expect(readdirSync(BRAND).sort()).toEqual(['logo-mark.svg', 'logo-wordmark.svg']);
  });

  test('the favicon is the mark, not the wordmark', () => {
    // The wordmark is 326.7 units wide against 112.62 tall and unreadable at 16px. A square
    // viewBox is the cheap proof that the icon is not that file.
    const favicon = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8');
    expect(favicon).toContain('viewBox="0 0 512 512"');
  });

  test('public holds only the fixed-URL files', () => {
    const found = walk(PUBLIC)
      .map((file) => posix.join(...relative(PUBLIC, file).split(/[/\\]/)))
      .sort();

    expect(found).toEqual([...PUBLIC_ALLOWLIST].sort());
  });
});
