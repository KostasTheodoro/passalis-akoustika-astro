import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CATALOGUE } from '../../src/data/catalogue';
import { hearingTypePath, ROUTES } from '../../src/data/routes';

/**
 * `/akoustika` and the four category pages.
 *
 * The expected content is read off the collection files rather than written out here, for the
 * reason `content-integrity.test.ts` gives: a list of thirteen model names copied into a test is a
 * second source of truth that drifts. Here it means adding a model to a YAML file is enough — this
 * suite then asserts it renders, in the right category, in the right position.
 *
 * `src/data/catalogue.ts` *is* imported directly, because it holds no image imports and
 * Playwright's transpiler can read it. `src/data/home.ts` cannot be, which is why `home.spec.ts`
 * says so at the top.
 */

const CONTENT_ROOT = 'src/content';

/**
 * A reader for the two shapes these collection files actually use, and nothing else.
 *
 * `tests/unit/content-integrity.test.ts` parses the same files with `Bun.YAML`, which is the right
 * tool — but Playwright runs its specs under Node, where there is no `Bun` global, and this step
 * adds no dependencies. So rather than copy thirteen model names into this file and let the two
 * drift, these three functions read the fields back out.
 *
 * Every one of them throws if the field is missing. A YAML shape they cannot read fails the suite
 * loudly rather than quietly asserting nothing.
 */

/** `key: value`, or a `key: >-` folded block, at the start of a line. */
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

/** The indented body under `key:`, de-indented by two spaces so `field()` can read it. */
function nested(source: string, key: string, file: string): string {
  const match = source.match(new RegExp(`^${key}:\\n((?:[ \\t]+[^\\n]*\\n?)+)`, 'm'));
  if (!match?.[1]) throw new Error(`${file} has no "${key}:" block.`);

  return match[1].replace(/^ {2}/gm, '');
}

function readCollection(collection: string) {
  const directory = join(CONTENT_ROOT, collection);

  return readdirSync(directory)
    .filter((file) => extname(file) === '.yaml')
    .map((file) => {
      const path = join(directory, file);
      return {
        id: basename(file, '.yaml'),
        file: path,
        source: readFileSync(path, 'utf8'),
      };
    });
}

const types = readCollection('hearing-types')
  .map((entry) => ({
    id: entry.id,
    order: Number(field(entry.source, 'order', entry.file)),
    title: field(entry.source, 'title', entry.file),
    description: field(entry.source, 'description', entry.file),
    heading: `${field(entry.source, 'shortTitle', entry.file)} (${field(entry.source, 'latinAbbreviation', entry.file)})`,
    seo: (() => {
      const block = nested(entry.source, 'seo', entry.file);
      return {
        title: field(block, 'title', entry.file),
        description: field(block, 'description', entry.file),
      };
    })(),
  }))
  .sort((a, b) => a.order - b.order);

const models = readCollection('hearing-models')
  .map((entry) => ({
    id: entry.id,
    order: Number(field(entry.source, 'order', entry.file)),
    type: field(entry.source, 'type', entry.file),
    name: field(entry.source, 'name', entry.file),
    description: field(entry.source, 'description', entry.file),
  }))
  .sort((a, b) => a.order - b.order);

/** Everything one category page should render, derived from the content itself. */
const categories = types.map((type) => ({
  ...type,
  path: hearingTypePath(type.id),
  models: models.filter((model) => model.type === type.id),
}));

const ALL_CATALOGUE_ROUTES = [ROUTES.hearingAids, ...categories.map((category) => category.path)];

/**
 * The reader above is the thing every other assertion in this file trusts. If it ever silently
 * returns nothing, the content assertions would pass against empty strings.
 */
test.describe('the expectations were actually read', () => {
  test('four categories and thirteen models, each with real copy', () => {
    expect(types).toHaveLength(4);
    expect(models).toHaveLength(13);

    for (const type of types) {
      for (const value of [
        type.title,
        type.description,
        type.heading,
        type.seo.title,
        type.seo.description,
      ]) {
        expect(value.length, `${type.id} has an empty field`).toBeGreaterThan(5);
      }
    }

    for (const model of models) {
      expect(model.name.length, `${model.id} has no name`).toBeGreaterThan(5);
      expect(model.description.length, `${model.id} has no description`).toBeGreaterThan(20);
    }

    // Every model reaches a category, and every category has models.
    expect(categories.flatMap((category) => category.models)).toHaveLength(models.length);
    for (const category of categories) {
      expect(category.models.length, `${category.id} has no models`).toBeGreaterThan(0);
    }
  });
});

test.describe('routing and status codes', () => {
  for (const path of ALL_CATALOGUE_ROUTES) {
    test(`${path} is 200`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
    });
  }

  /**
   * The defect this step exists to fix. The live site takes any slug at all and renders
   * "Δεν βρέθηκε αυτή η κατηγορία." at HTTP 200, indexable and self-canonical.
   *
   * `silk-cic` is in the list on purpose: it is a real model id, so it is exactly the address
   * someone would guess if they expected model-detail pages. There are none, and there is no
   * thin route standing in for one.
   */
  for (const path of [
    '/akoustika/foo',
    '/akoustika/silk-cic',
    '/akoustika/cic/extra',
    '/kati-allo',
  ]) {
    test(`${path} is a real 404`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    });
  }

  test('the 404 page is in Greek and offers a way out', async ({ page }) => {
    await page.goto('/akoustika/foo');

    await expect(page.locator('h1')).toHaveText('Η σελίδα δεν βρέθηκε');
    // The legacy site's generic 404 is Next's English default on an all-Greek site.
    await expect(page.locator('main')).not.toContainText('This page could not be found');

    await expect(page.locator(`main a[href="${ROUTES.home}"]`)).toBeVisible();
    await expect(page.locator(`main a[href="${ROUTES.hearingAids}"]`)).toBeVisible();
  });
});

test.describe('the listing', () => {
  test('has one main, one h1, and no heading level is skipped', async ({ page }) => {
    await page.goto(ROUTES.hearingAids);

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);

    const levels = await page
      .locator('main h1, main h2, main h3, main h4')
      .evaluateAll((headings) => headings.map((h) => Number(h.tagName.slice(1))));

    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      const step = (levels[i] as number) - (levels[i - 1] as number);
      expect(
        step,
        `heading order jumps from h${levels[i - 1]} to h${levels[i]}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  test('keeps the live site heading', async ({ page }) => {
    await page.goto(ROUTES.hearingAids);
    await expect(page.locator('h1')).toHaveText(CATALOGUE.listing.heading);
  });

  test('shows the four categories in production order, with their own copy', async ({ page }) => {
    await page.goto(ROUTES.hearingAids);

    const cards = page.locator('main ul > li');
    await expect(cards).toHaveCount(categories.length);

    for (const [index, type] of types.entries()) {
      const card = cards.nth(index);
      await expect(card.locator('h2')).toHaveText(type.title);
      await expect(card).toContainText(type.description);
    }
  });

  /**
   * One link per card, and it is the button. The card surface is deliberately not also a link:
   * that would be two tab stops to one destination, which is the finding the maintainer raised
   * against the EOPYY card in STEP-05.
   */
  test('each card has exactly one link, to its own category', async ({ page }) => {
    await page.goto(ROUTES.hearingAids);

    const cards = page.locator('main ul > li');

    for (const [index, category] of categories.entries()) {
      const links = cards.nth(index).locator('a');
      await expect(links).toHaveCount(1);
      await expect(links).toHaveAttribute('href', category.path);
    }
  });

  test('the four buttons do not all answer to the same name', async ({ page }) => {
    await page.goto(ROUTES.hearingAids);

    const names = await page
      .locator('main ul > li a')
      .evaluateAll((links) =>
        links.map((link) => (link.textContent ?? '').replace(/\s+/g, ' ').trim()),
      );

    expect(names).toHaveLength(categories.length);
    for (const name of names) {
      expect(name).toContain(CATALOGUE.listing.cardCta);
    }
    expect(new Set(names).size, `accessible names repeat: ${names.join(' | ')}`).toBe(names.length);
  });
});

test.describe('the category pages', () => {
  for (const category of categories) {
    test.describe(category.id, () => {
      test('is headed the way the live site heads it', async ({ page }) => {
        await page.goto(category.path);

        await expect(page.locator('main')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveText(category.heading);
        await expect(page.locator('main')).toContainText(category.description);
      });

      test('renders its own models, in order, with their descriptions', async ({ page }) => {
        await page.goto(category.path);

        const cards = page.locator('main ul > li');
        await expect(cards).toHaveCount(category.models.length);

        for (const [index, model] of category.models.entries()) {
          const card = cards.nth(index);
          await expect(card.locator('h2')).toHaveText(model.name);
          // The description is the reason these are rows rather than tiles.
          await expect(card).toContainText(model.description);
        }
      });

      test('does not link a model anywhere, because there is nowhere to go', async ({ page }) => {
        await page.goto(category.path);
        await expect(page.locator('main ul > li a')).toHaveCount(0);
      });

      test('numbers its headings without skipping a level', async ({ page }) => {
        await page.goto(category.path);

        const levels = await page
          .locator('main h1, main h2, main h3, main h4')
          .evaluateAll((headings) => headings.map((h) => Number(h.tagName.slice(1))));

        expect(levels[0]).toBe(1);
        for (let i = 1; i < levels.length; i++) {
          const step = (levels[i] as number) - (levels[i - 1] as number);
          expect(step).toBeLessThanOrEqual(1);
        }
      });
    });
  }

  test('every model in the collection appears on exactly one category page', async ({ page }) => {
    const seen = new Set<string>();

    for (const category of categories) {
      await page.goto(category.path);
      const names = await page
        .locator('main ul > li h2')
        .evaluateAll((headings) => headings.map((h) => (h.textContent ?? '').trim()));

      for (const name of names) {
        expect(seen.has(name), `"${name}" appears on more than one category page`).toBe(false);
        seen.add(name);
      }
    }

    expect(seen.size, 'a model in the collection reaches no page').toBe(models.length);
  });
});

test.describe('breadcrumbs', () => {
  test('the listing trail is Αρχική › Ακουστικά, and the last item is not a link', async ({
    page,
  }) => {
    await page.goto(ROUTES.hearingAids);

    const trail = page.getByRole('navigation', { name: 'Διαδρομή πλοήγησης' });
    const items = trail.locator('li');

    await expect(items).toHaveCount(2);
    await expect(items.nth(0).locator('a')).toHaveAttribute('href', ROUTES.home);
    await expect(items.nth(1).locator('a')).toHaveCount(0);
    await expect(items.nth(1).locator('[aria-current="page"]')).toHaveText('Ακουστικά');
  });

  for (const category of categories) {
    test(`the ${category.id} trail names the category and links back`, async ({ page }) => {
      await page.goto(category.path);

      const items = page.getByRole('navigation', { name: 'Διαδρομή πλοήγησης' }).locator('li');

      await expect(items).toHaveCount(3);
      await expect(items.nth(0).locator('a')).toHaveAttribute('href', ROUTES.home);
      await expect(items.nth(1).locator('a')).toHaveAttribute('href', ROUTES.hearingAids);
      await expect(items.nth(2).locator('a')).toHaveCount(0);
      await expect(items.nth(2).locator('[aria-current="page"]')).toHaveText(category.heading);
    });
  }
});

test.describe('the contact band', () => {
  for (const path of ALL_CATALOGUE_ROUTES) {
    test(`${path} offers a way to get in touch`, async ({ page }) => {
      await page.goto(path);

      const band = page.locator('section[aria-labelledby="catalogue-cta-heading"]');
      await expect(band).toHaveCount(1);
      await expect(band).toContainText(CATALOGUE.contact.description);

      const buttons = band.locator('a');
      await expect(buttons).toHaveCount(1);
      await expect(buttons).toHaveAttribute('href', ROUTES.contact);
    });
  }

  /**
   * STEP-05 took the shop's details out of the footer so they stop repeating under every page.
   * This band is not allowed to put them back.
   */
  test('does not repeat the shop details', async ({ page }) => {
    await page.goto(ROUTES.hearingAids);

    const band = page.locator('section[aria-labelledby="catalogue-cta-heading"]');
    await expect(band.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(band.locator('a[href^="mailto:"]')).toHaveCount(0);
  });

  /**
   * It shipped white, directly above a white footer, and the two read as one block — the maintainer
   * raised it on first inspection. The band is grey now, with its content in a white card. This
   * asserts the separation rather than the colours, so either may be retuned.
   */
  test('does not disappear into the footer', async ({ page }) => {
    await page.goto(ROUTES.hearingAids);

    const grounds = await page.evaluate(() => {
      const band = document.querySelector('section[aria-labelledby="catalogue-cta-heading"]');
      const footer = document.querySelector('footer');
      if (!band || !footer) return null;

      return {
        band: getComputedStyle(band).backgroundColor,
        footer: getComputedStyle(footer).backgroundColor,
      };
    });

    expect(grounds, 'the band or the footer was not found').not.toBeNull();
    expect(
      grounds?.band,
      `the band and the footer are both ${grounds?.band}, so they read as one block`,
    ).not.toBe(grounds?.footer);
  });
});

test.describe('the shell knows where you are', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a category page marks its section and its own entry in the header', async ({ page }) => {
    await page.goto(ROUTES.hearingAidsCic);

    // The top-level link is a section ancestor, not the page — so it is marked, but not `current`.
    const section = page.locator(`header nav a[href="${ROUTES.hearingAids}"]`).first();
    await expect(section).toHaveClass(/underline/);

    const own = page.locator(`header nav a[href="${ROUTES.hearingAidsCic}"]`).first();
    await expect(own).toHaveAttribute('aria-current', 'page');
  });

  test('the listing itself is the current page', async ({ page }) => {
    await page.goto(ROUTES.hearingAids);

    const link = page.locator(`header nav a[href="${ROUTES.hearingAids}"]`).first();
    await expect(link).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('assets', () => {
  for (const path of ALL_CATALOGUE_ROUTES) {
    test(`${path} carries alt text and dimensions on every photo`, async ({ page }) => {
      await page.goto(path);

      const images = await page.locator('main img').evaluateAll((nodes) =>
        nodes.map((node) => {
          const img = node as HTMLImageElement;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            width: img.getAttribute('width'),
            height: img.getAttribute('height'),
            loading: img.getAttribute('loading'),
          };
        }),
      );

      expect(images.length).toBeGreaterThan(0);

      for (const image of images) {
        // Nothing on these pages is decorative — every photo shows a product.
        expect(image.alt?.trim(), `${image.src} has no alt text`).toBeTruthy();
        expect(image.width, `${image.src} has no width`).toBeTruthy();
        expect(image.height, `${image.src} has no height`).toBeTruthy();
      }

      // Exactly one eager image, and it is the first: the LCP candidate.
      const eager = images.filter((image) => image.loading === 'eager');
      expect(eager, `${path} should have one eager image`).toHaveLength(1);
      expect(images[0]?.loading).toBe('eager');
    });
  }

  /**
   * Until STEP-03 every product photo on exactly these pages came from a third-party host, one of
   * them over plain http — which is why the live catalogue fails Lighthouse's mixed-content check.
   */
  test('a category page loads nothing from another origin', async ({ page, baseURL }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(baseURL as string) && !request.url().startsWith('data:')) {
        external.push(request.url());
      }
    });

    await page.goto(ROUTES.hearingAidsCic);
    await page.waitForLoadState('networkidle');

    expect(external).toEqual([]);
  });
});

test.describe('metadata', () => {
  test('every catalogue route has its own title and description', async ({ page }) => {
    const seen: { path: string; title: string; description: string }[] = [];

    for (const path of ALL_CATALOGUE_ROUTES) {
      await page.goto(path);
      seen.push({
        path,
        title: await page.title(),
        description: (await page.locator('meta[name="description"]').getAttribute('content')) ?? '',
      });
    }

    for (const entry of seen) {
      expect(entry.title.trim(), `${entry.path} has no title`).toBeTruthy();
      expect(entry.description.trim(), `${entry.path} has no description`).toBeTruthy();
    }

    expect(new Set(seen.map((entry) => entry.title)).size).toBe(seen.length);
    expect(new Set(seen.map((entry) => entry.description)).size).toBe(seen.length);
  });

  test('each category page carries the metadata its own entry holds', async ({ page }) => {
    for (const category of categories) {
      await page.goto(category.path);

      await expect(page).toHaveTitle(category.seo.title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        category.seo.description,
      );
    }
  });
});

/**
 * The cards ran to the site-wide 1200px container when the catalogue first shipped, which left a
 * 690px text column and a two-line description beside a tall photo — the card read as mostly air.
 * The maintainer's fix was "less width and more height". 1024px is the width they chose.
 */
test.describe('the cards keep their measure', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const path of [ROUTES.hearingAids, ROUTES.hearingAidsCic]) {
    test(`${path} caps its card list at 1024px`, async ({ page }) => {
      await page.goto(path);

      const width = await page
        .locator('main ul')
        .first()
        .evaluate((list) => list.getBoundingClientRect().width);

      expect(width, `the card list is ${Math.round(width)}px wide`).toBeLessThanOrEqual(1024);
      // Guards the other direction too: a list that collapsed to nothing would also pass above.
      expect(width).toBeGreaterThan(800);
    });
  }

  test('a model row is taller than it is short, now the copy has grown', async ({ page }) => {
    await page.goto(ROUTES.hearingAidsCic);

    const heights = await page
      .locator('main ul > li')
      .evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().height)));

    expect(heights.length).toBeGreaterThan(0);
    for (const height of heights) {
      // The photo alone is 240px; anything under 280 means the box shrank back.
      expect(height, `a model card is only ${height}px tall`).toBeGreaterThanOrEqual(280);
    }
  });
});

test.describe('the catalogue holds together at every supported width', () => {
  for (const path of [ROUTES.hearingAids, ROUTES.hearingAidsCic]) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      test(`${path} does not scroll sideways at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );

        expect(overflow, `the page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
      });
    }
  }
});
