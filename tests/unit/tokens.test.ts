import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * The design tokens claim specific contrast ratios in their comments. This file recomputes them
 * from the actual declared values, so the claims cannot drift away from the colours — and so a
 * future "let's lighten the teal slightly" is caught here rather than by a Lighthouse run three
 * steps later.
 *
 * It also holds the line `design-tokens.md` draws: components consume tokens, and a raw hex in a
 * component is the exact thing that made the legacy stylesheet impossible to reason about.
 */

const css = readFileSync('src/styles/global.css', 'utf8');

/** Reads a custom property's value, following `var(--other)` aliases to the literal behind them. */
function token(name: string): string {
  const match = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'));
  if (!match) throw new Error(`--${name} is not declared in global.css`);

  const value = (match[1] as string).trim();
  const alias = value.match(/^var\(--([\w-]+)\)$/);
  return alias ? token(alias[1] as string) : value;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) throw new Error(`${hex} is not a six-digit hex colour`);

  const [r, g, b] = [0, 2, 4].map((i) => channel(Number.parseInt(clean.slice(i, i + 2), 16)));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light as number) + 0.05) / ((dark as number) + 0.05);
}

const WHITE = '#ffffff';

describe('contrast ratios', () => {
  /** WCAG AA: 4.5:1 for normal-size text, 3:1 for large text and non-text UI. */
  const AA_TEXT = 4.5;
  const AA_LARGE = 3;

  test.each([
    ['ink', AA_TEXT],
    ['ink-muted', AA_TEXT],
    ['brand-strong', AA_TEXT],
    ['brand-deep', AA_TEXT],
    ['success', AA_TEXT],
    ['error', AA_TEXT],
    ['warning', AA_TEXT],
    ['brand', AA_LARGE],
  ])('--color-%s meets %s:1 on white', (name, minimum) => {
    const ratio = contrast(token(`color-${name}`), WHITE);
    expect(ratio, `--color-${name} is ${ratio.toFixed(2)}:1 on white`).toBeGreaterThanOrEqual(
      minimum as number,
    );
  });

  test('white labels on a brand-strong fill meet AA', () => {
    // This is the whole reason `--color-brand-strong` exists: white on `--color-brand` is only
    // 3.38:1, which is not enough behind a button label.
    const ratio = contrast(WHITE, token('color-brand-strong'));
    expect(ratio, `white on brand-strong is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  test('the inverse focus ring is visible on a brand fill', () => {
    const ratio = contrast(token('color-focus-inverse'), token('color-brand'));
    expect(ratio, `focus-inverse on brand is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });

  test('the focus ring is visible on the page background', () => {
    const ratio = contrast(token('color-focus'), token('color-page'));
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  test('the teal ramp gets progressively darker', () => {
    const ramp = ['brand-50', 'brand-100', 'brand', 'brand-strong', 'brand-deep'].map((name) =>
      luminance(token(`color-${name}`)),
    );

    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i] as number, `--color-${ramp[i]} breaks the ramp order`).toBeLessThan(
        ramp[i - 1] as number,
      );
    }
  });
});

describe('token discipline', () => {
  test('the brand colours are the ones the logo actually uses', () => {
    const logo = readFileSync('src/assets/brand/logo-mark.svg', 'utf8').toLowerCase();

    expect(logo, 'the teal token is not in the logo').toContain(token('color-brand'));
    expect(logo, 'the ink token is not in the logo').toContain(token('color-ink'));
  });

  test('no core colour token carries an alpha channel', () => {
    // The legacy `--color-light-bg: #f6f6f6d3` made contrast depend on whatever sat behind it.
    for (const name of ['brand', 'brand-strong', 'ink', 'ink-muted', 'surface', 'page']) {
      expect(token(`color-${name}`), `--color-${name} is not an opaque hex`).toMatch(
        /^#[0-9a-f]{6}$/i,
      );
    }
  });

  test('no component hard-codes a colour', () => {
    const walk = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      });

    const components = [...walk('src/components'), 'src/layouts/BaseLayout.astro'].filter((file) =>
      ['.astro', '.ts', '.tsx'].includes(extname(file)),
    );

    for (const file of components) {
      const source = readFileSync(file, 'utf8');
      // Matches `#abc`, `#aabbcc`, `rgb(...)` and `hsl(...)`, but not `#main` or `#id-name`.
      const found = source.match(/#[0-9a-f]{3}([0-9a-f]{3})?\b|\b(rgba?|hsla?)\(/gi);

      expect(found, `${file} hard-codes ${found?.join(', ')} instead of using a token`).toBeNull();
    }
  });
});
