import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { BUSINESS } from '../../src/data/business';
import { ROUTES } from '../../src/data/routes';

// `src/data/home.ts` is deliberately not imported here. It imports its images, which is the whole
// point of that file — a renamed asset fails the build — but Playwright's transpiler is not Vite
// and chokes on the first PNG. Everything this suite needs from it is read off the rendered page.

test('home page loads and renders without console errors', async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/.+/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'el');
  expect(consoleErrors).toEqual([]);
});

test('the page loads nothing from another origin', async ({ page, baseURL }) => {
  // Until STEP-03 every product photo came from a third-party host, one of them over plain
  // http. Nothing should leave the origin now, and no page in this project may reintroduce it.
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL as string) && !request.url().startsWith('data:')) {
      external.push(request.url());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(external).toEqual([]);
});

test('Sansation is preloaded once per upright face and applied', async ({ page }) => {
  await page.goto('/');

  const preloads = page.locator('link[rel="preload"][as="font"]');
  await expect(preloads).toHaveCount(2);

  for (const link of await preloads.all()) {
    await expect(link).toHaveAttribute('type', 'font/woff2');
    await expect(link).toHaveAttribute('crossorigin', '');
  }

  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family).toContain('Sansation');
});

test('every icon the document declares actually resolves', async ({ page, request }) => {
  await page.goto('/');

  const hrefs = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).getAttribute('href')));

  expect(hrefs).toEqual(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']);

  for (const href of hrefs) {
    const response = await request.get(href as string);
    expect(response.status(), `${href} did not resolve`).toBe(200);
  }
});

/**
 * The page itself.
 *
 * Everything above this point guards the document; everything below guards what the reader
 * actually gets. The section order, the calls to action and the featured selection are all things
 * the maintainer approved explicitly, so they are asserted rather than left to a screenshot.
 */

const CATEGORY_ROUTES = [
  ROUTES.hearingAidsCic,
  ROUTES.hearingAidsRechargeable,
  ROUTES.hearingAidsRic,
  ROUTES.hearingAidsBte,
];

/** The section landmarks, in the order the maintainer approved. */
const SECTIONS = [
  'hero-heading',
  'services-heading',
  'eopyy-heading',
  'featured-heading',
  'contact-heading',
  'signia-heading',
];

test.describe('page structure', () => {
  test('the six sections appear in the approved order', async ({ page }) => {
    await page.goto('/');

    const order = await page
      .locator('main section[aria-labelledby]')
      .evaluateAll((sections) => sections.map((s) => s.getAttribute('aria-labelledby')));

    expect(order).toEqual(SECTIONS);
  });

  test('the app section is last and the hero is first', async ({ page }) => {
    await page.goto('/');

    const order = await page
      .locator('main section[aria-labelledby]')
      .evaluateAll((sections) => sections.map((s) => s.getAttribute('aria-labelledby')));

    expect(order.at(0)).toBe('hero-heading');
    expect(order.at(-1)).toBe('signia-heading');
  });

  test('there is one h1 and no heading level is skipped', async ({ page }) => {
    await page.goto('/');

    const levels = await page
      .locator('main h1, main h2, main h3, main h4')
      .evaluateAll((headings) => headings.map((h) => Number(h.tagName.slice(1))));

    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);

    for (let i = 1; i < levels.length; i++) {
      const step = (levels[i] as number) - (levels[i - 1] as number);
      expect(
        step,
        `heading order jumps from h${levels[i - 1]} to h${levels[i]}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  test('every section landmark resolves to a heading that exists', async ({ page }) => {
    await page.goto('/');

    for (const id of SECTIONS) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });
});

test.describe('the journey to contact', () => {
  test('the hero offers contact first and the FAQ second', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('section[aria-labelledby="hero-heading"] a');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', ROUTES.contact);
    await expect(links.nth(1)).toHaveAttribute('href', ROUTES.faq);
  });

  test('the closing band offers the form and the telephone', async ({ page }) => {
    await page.goto('/');

    const band = page.locator('section[aria-labelledby="contact-heading"]');
    const links = band.locator('a');

    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', ROUTES.contact);
    await expect(links.nth(0)).not.toBeEmpty();
    await expect(links.nth(1)).toHaveAttribute('href', BUSINESS.telephone.href);
    await expect(links.nth(1)).toContainText(BUSINESS.telephone.display);
  });

  test('home links to the catalogue, EOPYY, the FAQ and contact', async ({ page }) => {
    await page.goto('/');

    for (const route of [ROUTES.hearingAids, ROUTES.eopyy, ROUTES.faq, ROUTES.contact]) {
      await expect(page.locator(`main a[href="${route}"]`).first()).toBeVisible();
    }
  });
});

test.describe('featured hearing aids', () => {
  test('there are four, one per category, each linking to its category', async ({ page }) => {
    await page.goto('/');

    const cards = page.locator('section[aria-labelledby="featured-heading"] li');
    await expect(cards).toHaveCount(4);

    const hrefs = await cards
      .locator('a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href')));

    expect(hrefs).toEqual(CATEGORY_ROUTES);
  });

  test('each whole-card link has an accessible name', async ({ page }) => {
    await page.goto('/');

    const links = page.locator('section[aria-labelledby="featured-heading"] li a');

    for (const link of await links.all()) {
      const name = await link.getAttribute('aria-label');
      expect(name?.trim(), 'an overlay link has no accessible name').toBeTruthy();
    }
  });

  /**
   * A linked card draws its focus ring 2px outside the overlay anchor, which is the card's own
   * edge — so `overflow-hidden` anywhere up the chain clips the ring away and the card becomes a
   * control a keyboard user cannot see themselves land on. This caught exactly that.
   */
  test('the focus ring on a card is not clipped by an ancestor', async ({ page }) => {
    await page.goto('/');

    const clipped = await page.evaluate(() => {
      const link = document.querySelector<HTMLElement>(
        'section[aria-labelledby="featured-heading"] li a',
      );
      if (!link) return ['no card link found'];

      const offenders: string[] = [];
      for (
        let node = link.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const { overflow, overflowX, overflowY } = getComputedStyle(node);
        if (
          [overflow, overflowX, overflowY].some((value) => value === 'hidden' || value === 'clip')
        ) {
          offenders.push(`${node.tagName.toLowerCase()}.${node.className}`);
        }
      }
      return offenders;
    });

    expect(clipped, `the focus ring is clipped by ${clipped.join(', ')}`).toEqual([]);
  });

  test('the four photo frames are identical, so the row lines up', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const frames = await page
      // `:first-of-type` is the photo frame; the second div in each card is the text block.
      .locator('section[aria-labelledby="featured-heading"] li > div:first-of-type')
      .evaluateAll((boxes) => boxes.map((b) => Math.round(b.getBoundingClientRect().height)));

    expect(new Set(frames).size, `photo frames differ: ${frames.join(', ')}`).toBe(1);
  });
});

test('the EOPYY card shows the figure the content file holds', async ({ page }) => {
  const source = readFileSync('src/content/pages/eopyy.md', 'utf8');
  const amount = source.match(/adultAmount:\s*(\d+)/)?.[1];
  expect(amount, 'eopyy.md has no adultAmount').toBeTruthy();

  await page.goto('/');

  const card = page.locator('section[aria-labelledby="eopyy-heading"]');
  await expect(card).toContainText(`${amount}€`);
  await expect(card.locator('a')).toHaveAttribute('href', ROUTES.eopyy);
});

test('both store links open away from the site, safely', async ({ page }) => {
  await page.goto('/');

  const links = page.locator('section[aria-labelledby="signia-heading"] a[target="_blank"]');
  await expect(links).toHaveCount(2);

  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('rel', /noopener/);
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^https:\/\//);
  }
});

test('every image carries alt text and its own dimensions', async ({ page }) => {
  await page.goto('/');

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
    // An empty alt is a claim that the image is decorative. Only the hero makes it.
    expect(image.alt, `${image.src} has no alt attribute at all`).not.toBeNull();
    if (image.alt === '') {
      expect(image.loading, 'only the hero may be decorative, and it is not lazy').toBe('eager');
    } else {
      expect(image.loading, `${image.src} should be lazy`).toBe('lazy');
    }
    expect(image.width, `${image.src} has no width`).toBeTruthy();
    expect(image.height, `${image.src} has no height`).toBeTruthy();
  }
});

test.describe('the hero', () => {
  test('serves the square crop on a phone and the wide one on a desktop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const onPhone = await page
      .locator('picture img')
      .evaluate((img) => (img as HTMLImageElement).currentSrc);
    expect(onPhone).toContain('hero-mobile');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const onDesktop = await page
      .locator('picture img')
      .evaluate((img) => (img as HTMLImageElement).currentSrc);
    expect(onDesktop).toContain('hero-desktop');
  });

  /**
   * The scrim is proved against pure white in `tests/unit/tokens.test.ts`. This measures the real
   * thing: the brightest pixel of the crop the browser actually chose, flattened under the scrim
   * the browser actually computed.
   */
  for (const [label, width] of [
    ['phone', 390],
    ['desktop', 1440],
  ] as const) {
    test(`white hero text clears AA over the ${label} crop`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page
        .locator('picture img')
        .evaluate((img: HTMLImageElement) =>
          img.complete ? Promise.resolve() : new Promise((r) => img.addEventListener('load', r)),
        );

      const ratio = await page.evaluate(async () => {
        const img = document.querySelector('picture img') as HTMLImageElement;
        const scrim = getComputedStyle(document.querySelector('.bg-hero-scrim') as Element)
          .backgroundColor.match(/[\d.]+/g)
          ?.map(Number) as number[];
        const [sr, sg, sb, sa] = [
          scrim[0] as number,
          scrim[1] as number,
          scrim[2] as number,
          scrim[3] ?? 1,
        ];

        const bitmap = await createImageBitmap(img);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d') as CanvasRenderingContext2D;
        context.drawImage(bitmap, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

        const channel = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };

        let brightest = 0;
        for (let i = 0; i < data.length; i += 4) {
          const luminance =
            0.2126 * channel((data[i] as number) * (1 - sa) + sr * sa) +
            0.7152 * channel((data[i + 1] as number) * (1 - sa) + sg * sa) +
            0.0722 * channel((data[i + 2] as number) * (1 - sa) + sb * sa);
          if (luminance > brightest) brightest = luminance;
        }

        return 1.05 / (brightest + 0.05);
      });

      expect(ratio, `white on the ${label} hero is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    });
  }

  test('nothing shifts while the page loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const shift = await page.evaluate(() =>
      performance
        .getEntriesByType('layout-shift')
        .filter((entry) => !(entry as unknown as { hadRecentInput: boolean }).hadRecentInput)
        .reduce((total, entry) => total + (entry as unknown as { value: number }).value, 0),
    );

    expect(shift).toBe(0);
  });
});

test.describe('the page holds together at every supported width', () => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      expect(overflow, `the page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
    });
  }
});
