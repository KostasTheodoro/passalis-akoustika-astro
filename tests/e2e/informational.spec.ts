import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { INFORMATIONAL } from '../../src/data/informational';
import { ROUTES } from '../../src/data/routes';

/**
 * The five informational routes: About, FAQ, and the three partner pages.
 *
 * `src/data/informational.ts` is imported directly, for the reason `catalogue.spec.ts` gives about
 * `src/data/catalogue.ts`: it holds no image imports, so Playwright's transpiler can read it, and
 * asserting against the real strings beats copying Greek sentences into a second place where they
 * drift. It does import two logos, so only the string fields are touched here.
 *
 * The provider and FAQ expectations are read off the collection files instead, so adding a
 * question or a manufacturer is enough and this suite then checks it renders in the right place.
 */

const CONTENT_ROOT = 'src/content';

const ALL_ROUTES = [
  ROUTES.about,
  ROUTES.faq,
  ROUTES.partners,
  ROUTES.eopyy,
  ROUTES.providers,
] as const;

/** `key: value` or a `key: >-` folded block, at the start of a line. Mirrors `catalogue.spec.ts`. */
function field(source: string, key: string, file: string): string {
  const inline = source.match(new RegExp(`^${key}: (?!>)(.+)$`, 'm'));
  if (inline?.[1]) return inline[1].trim();

  const folded = source.match(new RegExp(`^${key}: >-?[^\\n]*\\n((?:[ \\t]+[^\\n]*\\n?)+)`, 'm'));
  if (folded?.[1]) {
    return folded[1]
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ');
  }

  throw new Error(`${file} has no readable "${key}" field.`);
}

function readProviders() {
  const directory = join(CONTENT_ROOT, 'providers');

  return readdirSync(directory)
    .filter((file) => extname(file) === '.yaml')
    .map((file) => {
      const path = join(directory, file);
      const source = readFileSync(path, 'utf8');
      return {
        id: basename(file, '.yaml'),
        name: field(source, 'name', path),
        website: field(source, 'website', path),
        order: Number(field(source, 'order', path)),
      };
    })
    .sort((a, b) => a.order - b.order);
}

function readFaqs() {
  const directory = join(CONTENT_ROOT, 'faqs');

  return readdirSync(directory)
    .filter((file) => extname(file) === '.md')
    .map((file) => {
      const path = join(directory, file);
      const source = readFileSync(path, 'utf8');
      return {
        id: basename(file, '.md'),
        question: field(source, 'question', path),
        order: Number(field(source, 'order', path)),
      };
    })
    .sort((a, b) => a.order - b.order);
}

const providers = readProviders();
const faqs = readFaqs();

test.describe('page structure', () => {
  for (const path of ALL_ROUTES) {
    test(`${path} is one page with one heading and no script`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} did not return 200`).toBe(200);

      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);

      // Everything so far ships zero external JavaScript. These five keep the run going.
      await expect(page.locator('script[src]')).toHaveCount(0);

      // No skipped level: the document goes h1 then h2, and nothing jumps straight to h3.
      const levels = await page.evaluate(() =>
        [...document.querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1])),
      );
      expect(levels[0], `${path} does not open with an h1`).toBe(1);
      for (const [index, level] of levels.entries()) {
        if (index === 0) continue;
        expect(level - (levels[index - 1] as number), `${path} skips a heading level`).toBeLessThan(
          2,
        );
      }
    });
  }

  for (const path of ALL_ROUTES) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      test(`${path} does not overflow sideways at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(0);
      });
    }
  }
});

test.describe('breadcrumbs', () => {
  const trails = [
    { path: ROUTES.about, labels: ['Αρχική', 'Σχετικά με εμάς'] },
    { path: ROUTES.faq, labels: ['Αρχική', 'Συχνές Ερωτήσεις'] },
    { path: ROUTES.partners, labels: ['Αρχική', 'Συνεργάτες'] },
    { path: ROUTES.eopyy, labels: ['Αρχική', 'Συνεργάτες', 'ΕΟΠΥΥ'] },
    { path: ROUTES.providers, labels: ['Αρχική', 'Συνεργάτες', 'Πάροχοι Βοηθημάτων Ακοής'] },
  ];

  for (const { path, labels } of trails) {
    test(`${path} shows its place in the site`, async ({ page }) => {
      await page.goto(path);

      const items = page.getByRole('navigation', { name: 'Διαδρομή πλοήγησης' }).locator('li');
      await expect(items).toHaveCount(labels.length);

      for (const [index, label] of labels.entries()) {
        await expect(items.nth(index)).toHaveText(label);
      }

      // The last crumb is the current page: not a link, and marked as current.
      const last = items.nth(labels.length - 1);
      await expect(last.locator('a')).toHaveCount(0);
      await expect(last.locator('[aria-current="page"]')).toHaveCount(1);
    });
  }
});

test.describe('the FAQ accordion', () => {
  test('renders every question from the collection, in order', async ({ page }) => {
    await page.goto(ROUTES.faq);

    const items = page.locator('main details');
    await expect(items).toHaveCount(faqs.length);

    for (const [index, faq] of faqs.entries()) {
      await expect(items.nth(index).locator('summary')).toContainText(faq.question);
    }
  });

  test('keeps every answer in the page while collapsed', async ({ page }) => {
    await page.goto(ROUTES.faq);

    // Collapsed answers are hidden, not absent, so they stay indexable and findable with Ctrl-F.
    await expect(page.locator('main details[open]')).toHaveCount(0);
    for (const faq of faqs) {
      await expect(page.locator('main details').filter({ hasText: faq.question })).toHaveCount(1);
    }

    const answered = await page.evaluate(
      () =>
        [...document.querySelectorAll('main details')].filter(
          (d) => (d.querySelector('div')?.textContent ?? '').trim().length > 0,
        ).length,
    );
    expect(answered, 'some answers are missing from the collapsed markup').toBe(faqs.length);
  });

  test('opens one panel at a time', async ({ page }) => {
    await page.goto(ROUTES.faq);

    const items = page.locator('main details');

    await items.nth(0).locator('summary').click();
    await expect(items.nth(0)).toHaveAttribute('open', '');

    // `details[name]` is what makes this exclusive, and it is the whole reason the page needs no
    // JavaScript. If the attribute is ever dropped, both panels stay open and this fails.
    await items.nth(2).locator('summary').click();
    await expect(items.nth(2)).toHaveAttribute('open', '');
    await expect(items.nth(0)).not.toHaveAttribute('open', '');
  });

  test('works from the keyboard alone', async ({ page }) => {
    await page.goto(ROUTES.faq);

    const first = page.locator('main details').first();
    await first.locator('summary').focus();
    await expect(first.locator('summary')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('open', '');

    await page.keyboard.press('Enter');
    await expect(first).not.toHaveAttribute('open', '');
  });
});

test.describe('the providers page', () => {
  /**
   * The card list, and not the feature list inside each card. Both are `ul > li`, so without the
   * `:not(li ul)` this counts thirty-six list items instead of four.
   */
  const CARDS = 'main ul:not(li ul) > li';

  test('lists every manufacturer in the order the collection sets', async ({ page }) => {
    await page.goto(ROUTES.providers);

    const cards = page.locator(CARDS);
    await expect(cards).toHaveCount(providers.length);

    for (const [index, provider] of providers.entries()) {
      await expect(cards.nth(index).locator('h2')).toHaveText(provider.name);
    }
  });

  test('names its outbound links properly and opens them safely', async ({ page }) => {
    await page.goto(ROUTES.providers);

    const cards = page.locator(CARDS);

    for (const [index, provider] of providers.entries()) {
      // Scoped to the card rather than the page, because two of the four share a destination:
      // Siemens points at signia.net, which is the client's own instruction, not a mistake.
      const link = cards.nth(index).locator(`a[href="${provider.website}"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);

      // The legacy link's accessible name was the alt text of a logo. This one says where it goes.
      const name = (await link.textContent())?.trim() ?? '';
      expect(name, `the ${provider.name} link has no visible label`).toContain(
        INFORMATIONAL.providers.websiteLabel,
      );
      expect(name, `the ${provider.name} link does not name its destination`).toContain(
        provider.name,
      );
    }
  });

  test('two cards deliberately share a destination', async ({ page }) => {
    // Pinned because it looks exactly like a copy-paste slip. It is the client's instruction, the
    // Siemens hearing business having become Signia, and the Siemens description now says so.
    await page.goto(ROUTES.providers);

    const shared = providers.filter((provider) => provider.website === 'https://www.signia.net/');
    expect(shared.map((provider) => provider.id).sort()).toEqual(['siemens', 'signia']);

    await expect(page.locator(`${CARDS} >> nth=3`)).toContainText('παραπέμπουν στον ίδιο ιστότοπο');
  });
});

test.describe('the EOPYY banner', () => {
  /**
   * The maintainer's instruction was that this reproduce the live page exactly, and that it took a
   * while to get right the first time. The three properties that produce it are asserted here so a
   * later layout change cannot quietly undo them.
   */
  for (const width of [390, 768, 1440]) {
    test(`runs edge to edge at the live ratio at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(ROUTES.eopyy);

      const measured = await page.evaluate(() => {
        const banner = document.querySelector('main img')?.parentElement;
        if (!banner) return null;

        const box = banner.getBoundingClientRect();
        const overlay = banner.querySelector('div');

        return {
          width: box.width,
          ratio: box.width / box.height,
          viewport: document.documentElement.clientWidth,
          ground: getComputedStyle(banner).backgroundColor,
          wash: overlay ? getComputedStyle(overlay).backgroundColor : null,
        };
      });

      expect(measured, 'the banner was not found').not.toBeNull();
      if (!measured) return;

      // Full-bleed: no container, no gutter.
      expect(Math.round(measured.width)).toBe(measured.viewport);

      // The live site's own 34/7 box. A different ratio is a different crop of the artwork.
      expect(measured.ratio).toBeCloseTo(34 / 7, 2);

      // White behind the artwork, which is transparent through its middle and right third. On the
      // page ground the ΕΟΠΥΥ mark would sit on grey instead.
      expect(measured.ground).toBe('rgb(255, 255, 255)');

      // The teal wash over the image is the reason the banner reads pale teal rather than white,
      // and it is the easiest of the three to lose by accident.
      expect(measured.wash, 'the teal wash over the banner is gone').toMatch(/0\.1\)?$/);
    });
  }
});

test.describe('local relevance', () => {
  /**
   * `seo.md` asks for local relevance "without keyword stuffing", so the locality is placed once
   * per page where a person would write it anyway. This is the cap that keeps it that way: two
   * mentions in the page body is a sentence about where the shop is plus one in the closing band,
   * and a third is a page starting to repeat itself at a reader.
   */
  for (const path of ALL_ROUTES) {
    test(`${path} names the locality without overdoing it`, async ({ page }) => {
      await page.goto(path);

      const count = await page.evaluate(
        () => (document.querySelector('main')?.textContent?.match(/Μαρούσι/g) ?? []).length,
      );
      expect(count, `${path} repeats the locality too often`).toBeLessThanOrEqual(2);
    });
  }

  test('the locality appears somewhere in this group of pages', async ({ page }) => {
    // The cap above passes if the word is absent everywhere, which would mean the local-search
    // work had quietly been undone.
    await page.goto(ROUTES.about);
    await expect(page.locator('main')).toContainText('Μαρούσι');
  });
});

test.describe('the contact band', () => {
  const banded = [
    { path: ROUTES.about, copy: INFORMATIONAL.about.contact },
    { path: ROUTES.faq, copy: INFORMATIONAL.faq.contact },
    { path: ROUTES.partners, copy: INFORMATIONAL.partners.contact },
    { path: ROUTES.providers, copy: INFORMATIONAL.providers.contact },
  ];

  for (const { path, copy } of banded) {
    test(`${path} closes with a way to get in touch`, async ({ page }) => {
      await page.goto(path);

      const band = page.locator('section[aria-labelledby="contact-band-heading"]');
      await expect(band).toHaveCount(1);
      await expect(band).toContainText(copy.description);

      const button = band.locator('a');
      await expect(button).toHaveCount(1);
      await expect(button).toHaveAttribute('href', ROUTES.contact);
    });
  }

  /**
   * The EOPYY page ends with the client's own call to action from its `cta` frontmatter. A second
   * band under it would be two of the same thing in a row.
   */
  test('the EOPYY page uses the client CTA instead of a second band', async ({ page }) => {
    await page.goto(ROUTES.eopyy);

    await expect(page.locator('section[aria-labelledby="contact-band-heading"]')).toHaveCount(0);
    await expect(page.locator(`main a[href="${ROUTES.contact}"]`)).toHaveCount(1);
  });

  /** STEP-05 took the shop's details out of the footer. These bands must not put them back. */
  for (const { path } of banded) {
    test(`${path} does not repeat the shop details`, async ({ page }) => {
      await page.goto(path);

      const band = page.locator('section[aria-labelledby="contact-band-heading"]');
      await expect(band.locator('a[href^="tel:"]')).toHaveCount(0);
      await expect(band.locator('a[href^="mailto:"]')).toHaveCount(0);
    });
  }
});
