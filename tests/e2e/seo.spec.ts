import { expect, type Page, test } from '@playwright/test';
import { BUSINESS } from '../../src/data/business';
import { ROUTES } from '../../src/data/routes';
import { LAST_MODIFIED, SITEMAP_ROUTES } from '../../src/data/sitemap';

/**
 * The document head, the three generated endpoints, and the internal link graph.
 *
 * This suite exists because none of what STEP-09 added is visible on the page. A missing canonical,
 * a `SearchAction` that crept back, an FAQ answer that stopped matching the text beside it — every
 * one of those ships silently and is found weeks later in Search Console, if at all.
 *
 * Everything is asserted against the built output through the preview server, so what is checked is
 * what Vercel would serve.
 */

/** Every indexable route, plus the one that must not be indexed. */
const INDEXABLE = SITEMAP_ROUTES;
const ALL_ROUTES = [...INDEXABLE, '/404-does-not-exist'];

const ORIGIN = BUSINESS.canonicalUrl;

/** Every JSON-LD block on the current page, parsed. */
async function structuredData(page: Page): Promise<Record<string, unknown>[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((block, index) => {
    try {
      return JSON.parse(block) as Record<string, unknown>;
    } catch (error) {
      throw new Error(`JSON-LD block ${index} is not valid JSON: ${(error as Error).message}`);
    }
  });
}

async function attr(page: Page, selector: string): Promise<string | null> {
  const locator = page.locator(selector);
  return (await locator.count()) === 0 ? null : locator.first().getAttribute('content');
}

test.describe('metadata on every route', () => {
  test('titles and descriptions are present and unique', async ({ page }) => {
    const seen: { path: string; title: string; description: string }[] = [];

    for (const path of INDEXABLE) {
      await page.goto(path);
      seen.push({
        path,
        title: await page.title(),
        description: (await attr(page, 'meta[name="description"]')) ?? '',
      });
    }

    for (const entry of seen) {
      expect(entry.title.trim(), `${entry.path} has no title`).toBeTruthy();
      expect(entry.description.trim(), `${entry.path} has no description`).toBeTruthy();
    }

    expect(new Set(seen.map((e) => e.title)).size, 'two routes share a title').toBe(seen.length);
    expect(new Set(seen.map((e) => e.description)).size, 'two routes share a description').toBe(
      seen.length,
    );
  });

  test('no title says the brand twice, and none is long enough to be truncated', async ({
    page,
  }) => {
    // The live site's `/synergates` reads "… | Πασσαλής Ακουστικά | Πασσαλής Ακουστικά", because
    // the page title already carried the brand and the template appended it again.
    for (const path of INDEXABLE) {
      await page.goto(path);
      const title = await page.title();
      const occurrences = title.split(BUSINESS.name).length - 1;

      expect(occurrences, `${path} names the brand ${occurrences} times: "${title}"`).toBe(1);
      expect(title.length, `${path} title is ${title.length} characters: "${title}"`).toBeLessThan(
        66,
      );
    }
  });

  test('each canonical is absolute, apex, and points at the page itself', async ({ page }) => {
    for (const path of INDEXABLE) {
      await page.goto(path);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      const expected = path === ROUTES.home ? `${ORIGIN}/` : `${ORIGIN}${path}`;

      expect(canonical, `${path} has the wrong canonical`).toBe(expected);
    }
  });

  test('no canonical carries a trailing slash except the root', async ({ page }) => {
    for (const path of INDEXABLE.filter((route) => route !== ROUTES.home)) {
      await page.goto(path);
      const canonical = (await page.locator('link[rel="canonical"]').getAttribute('href')) ?? '';
      expect(canonical.endsWith('/'), `${path} canonicalises with a trailing slash`).toBe(false);
    }
  });

  test('Open Graph and Twitter are complete and agree with the page', async ({ page }) => {
    for (const path of INDEXABLE) {
      await page.goto(path);

      const title = await page.title();
      const description = await attr(page, 'meta[name="description"]');

      expect(await attr(page, 'meta[property="og:title"]'), path).toBe(title);
      expect(await attr(page, 'meta[property="og:description"]'), path).toBe(description);
      expect(await attr(page, 'meta[property="og:type"]'), path).toBe('website');
      expect(await attr(page, 'meta[property="og:locale"]'), path).toBe(BUSINESS.locale);
      expect(await attr(page, 'meta[property="og:site_name"]'), path).toBe(BUSINESS.name);
      expect(await attr(page, 'meta[property="og:url"]'), path).toBe(
        await page.locator('link[rel="canonical"]').getAttribute('href'),
      );

      expect(await attr(page, 'meta[name="twitter:card"]'), path).toBe('summary_large_image');
      expect(await attr(page, 'meta[name="twitter:title"]'), path).toBe(title);
      expect(await attr(page, 'meta[name="twitter:image"]'), path).toBe(
        await attr(page, 'meta[property="og:image"]'),
      );
    }
  });

  test('the social image is declared at its real size and actually resolves', async ({
    page,
    request,
  }) => {
    await page.goto(ROUTES.home);

    const image = await attr(page, 'meta[property="og:image"]');
    expect(image).toBe(`${ORIGIN}/og/default.jpg`);
    expect(await attr(page, 'meta[property="og:image:width"]')).toBe('1200');
    expect(await attr(page, 'meta[property="og:image:height"]')).toBe('630');

    // The absolute URL points at production, so the file is fetched from this build instead.
    const response = await request.get('/og/default.jpg');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/jpeg');
  });

  test('every route is indexable, has one h1, and declares Greek', async ({ page }) => {
    for (const path of INDEXABLE) {
      await page.goto(path);

      expect(await attr(page, 'meta[name="robots"]'), path).toBe('index, follow');
      await expect(page.locator('h1'), path).toHaveCount(1);
      await expect(page.locator('html'), path).toHaveAttribute('lang', BUSINESS.language);
    }
  });

  test('the 404 is noindex and has no canonical at all', async ({ page }) => {
    // The live site's 404 canonicalises to the homepage, which asserts the two are one page.
    const response = await page.goto('/definitely-not-a-page');
    expect(response?.status()).toBe(404);

    expect(await attr(page, 'meta[name="robots"]')).toBe('noindex, follow');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });

  test('the icon and manifest links all resolve', async ({ page, request }) => {
    await page.goto(ROUTES.home);

    const hrefs = await page
      .locator('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));

    expect(hrefs).toContain('/manifest.json');
    expect(hrefs.length).toBeGreaterThanOrEqual(4);

    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), `${href} does not resolve`).toBe(200);
    }
  });

  test('the favicon is the circular mark, not a square tile', async ({ request }) => {
    // It shipped square once: the `.ico` came over from the live site circular, the SVG was drawn
    // separately as a white tile, and browsers prefer the SVG. Nobody noticed until review.
    const response = await request.get('/favicon.svg');
    const svg = await response.text();

    expect(svg).toContain('<circle cx="256" cy="256" r="256"');
    expect(svg).not.toMatch(/<rect[^>]*width="512"[^>]*height="512"/);
  });
});

test.describe('structured data', () => {
  test('every block is valid JSON and every route carries the business and the site', async ({
    page,
  }) => {
    for (const path of ALL_ROUTES) {
      await page.goto(path);
      const schemas = await structuredData(page);
      const types = schemas.map((schema) => schema['@type']);

      expect(types, path).toContain('HearingAidStore');
      expect(types, path).toContain('WebSite');
    }
  });

  test('no SearchAction is emitted anywhere', async ({ page }) => {
    // The live site declares one, pointing at `/?q={search_term_string}`. There is no search.
    for (const path of ALL_ROUTES) {
      await page.goto(path);
      const raw = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(
        '',
      );

      expect(raw, `${path} declares a SearchAction`).not.toContain('SearchAction');
      expect(raw, `${path} declares a potentialAction`).not.toContain('potentialAction');
    }
  });

  test('the business node describes the details the page shows', async ({ page }) => {
    await page.goto(ROUTES.contact);
    const [business] = (await structuredData(page)).filter(
      (schema) => schema['@type'] === 'HearingAidStore',
    );

    const address = business?.address as Record<string, string>;
    expect(business?.name).toBe(BUSINESS.name);
    expect(business?.telephone).toBe(BUSINESS.telephone.international);
    expect(address.streetAddress).toBe(BUSINESS.address.street);
    expect(address.addressLocality).toBe(BUSINESS.address.locality);

    // The same telephone and street are rendered in the footer, on every route.
    const footer = page.locator('footer');
    await expect(footer.locator(`a[href="${BUSINESS.telephone.href}"]`)).toBeVisible();
    await expect(footer).toContainText(BUSINESS.address.street);
  });

  test('no unverified claim is present', async ({ page }) => {
    for (const path of ALL_ROUTES) {
      await page.goto(path);
      const raw = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(
        '',
      );

      for (const forbidden of ['aggregateRating', 'priceRange', 'sameAs', 'legalName', 'review']) {
        expect(raw, `${path} claims ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test('the breadcrumb markup matches the trail the page draws', async ({ page }) => {
    for (const path of INDEXABLE.filter((route) => route !== ROUTES.home)) {
      await page.goto(path);

      const [crumbs] = (await structuredData(page)).filter(
        (schema) => schema['@type'] === 'BreadcrumbList',
      );
      expect(crumbs, `${path} renders a trail but emits no BreadcrumbList`).toBeDefined();

      const named = ((crumbs?.itemListElement ?? []) as { name: string }[]).map(
        (entry) => entry.name,
      );
      const rendered = await page
        .locator('nav[aria-label="Διαδρομή πλοήγησης"] li')
        .allInnerTexts();

      expect(named, `${path} markup and trail disagree`).toEqual(
        rendered.map((text) => text.trim()),
      );
    }
  });

  test('the home page emits no BreadcrumbList, because it draws no trail', async ({ page }) => {
    await page.goto(ROUTES.home);
    const types = (await structuredData(page)).map((schema) => schema['@type']);
    expect(types).not.toContain('BreadcrumbList');
  });

  test('every FAQ answer equals the text the page renders', async ({ page }) => {
    // This is the guard on `toPlainText`. One answer carries a link, so the raw MDX and the visible
    // sentence are different strings, and a stripper that mishandles future syntax would put an
    // answer in the markup that nobody can read on the page.
    await page.goto(ROUTES.faq);

    const [faq] = (await structuredData(page)).filter((schema) => schema['@type'] === 'FAQPage');
    const entries = faq?.mainEntity as {
      name: string;
      acceptedAnswer: { text: string };
    }[];

    const panels = page.locator('details');
    const count = await panels.count();
    expect(entries).toHaveLength(count);

    /**
     * `textContent`, not `innerText`. The accordion is native `<details name>`, so at most one
     * panel is open and `innerText` returns nothing for the rest — it reports rendered text.
     *
     * `textContent` is also the honest measure here: the answers being in the DOM while collapsed
     * is exactly what makes the `FAQPage` markup truthful, and it is what a crawler reads.
     */
    const rendered = await panels.evaluateAll((elements) =>
      elements.map((element) => {
        const summary = element.querySelector('summary');
        const question = (summary?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const whole = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
        return { question, answer: whole.slice(question.length).trim() };
      }),
    );

    for (let index = 0; index < count; index += 1) {
      const { question, answer } = rendered[index] as { question: string; answer: string };

      expect(answer, `panel ${index} renders no answer`).not.toBe('');
      expect(entries[index]?.name, `question ${index} differs`).toBe(question);
      expect(entries[index]?.acceptedAnswer.text, `answer to "${question}" differs`).toBe(answer);
    }
  });

  test('the about and contact pages carry their own page type', async ({ page }) => {
    for (const [path, type] of [
      [ROUTES.about, 'AboutPage'],
      [ROUTES.contact, 'ContactPage'],
    ] as const) {
      await page.goto(path);
      const types = (await structuredData(page)).map((schema) => schema['@type']);
      expect(types, path).toContain(type);
    }
  });
});

test.describe('sitemap, robots and manifest', () => {
  test('the sitemap lists every indexable route, and nothing else', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const xml = await response.text();
    const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    const expected = SITEMAP_ROUTES.map((path) =>
      path === ROUTES.home ? `${ORIGIN}/` : `${ORIGIN}${path}`,
    );

    expect(locations.sort()).toEqual([...expected].sort());
    expect(xml, 'the API endpoint is listed').not.toContain('/api');
    expect(xml, 'the 404 is listed').not.toContain('404');
  });

  test('the sitemap dates are real and not all the same', async ({ request }) => {
    // The live site gives all twelve URLs one identical build-time `lastmod`.
    const xml = await (await request.get('/sitemap.xml')).text();
    const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1] ?? '');

    expect(dates).toHaveLength(SITEMAP_ROUTES.length);
    for (const date of dates) {
      expect(date, `"${date}" is not an ISO date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(date)), `"${date}" is not a real date`).toBe(false);
    }

    expect(
      new Set(dates).size,
      'every route shares one date, as the live site does',
    ).toBeGreaterThan(1);
    expect(new Set(dates)).toEqual(new Set(Object.values(LAST_MODIFIED)));
  });

  test('robots allows crawling and advertises the sitemap without a redirect', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');

    const body = await response.text();
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /api/');

    // The live site advertises `/sitemap.xml/`, which 308s. An avoidable hop on every crawl.
    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(body).not.toContain('sitemap.xml/');
  });

  test('the manifest names the business and claims nothing it cannot do', async ({ request }) => {
    const response = await request.get('/manifest.json');
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as Record<string, unknown>;

    // The live site still ships "MyWebSite" / "MySite" from a starter template.
    expect(manifest.name).toBe(BUSINESS.name);
    expect(manifest.name).not.toContain('MyWebSite');
    expect(manifest.short_name).toBeTruthy();
    expect((manifest.short_name as string).length).toBeLessThanOrEqual(12);
    expect(manifest.lang).toBe(BUSINESS.language);

    // Not a PWA: there is no service worker and nothing works offline.
    expect(manifest.display).toBe('browser');

    const icons = manifest.icons as { src: string; purpose: string }[];
    expect(icons).toHaveLength(2);
    for (const icon of icons) {
      expect(icon.purpose, 'a maskable icon without safe-zone padding gets cropped').toBe('any');
      expect((await request.get(icon.src)).status(), `${icon.src} is missing`).toBe(200);
    }
  });
});

test.describe('internal links', () => {
  test('every internal link on every route resolves to a real page', async ({ page, request }) => {
    const known = new Set<string>(Object.values(ROUTES));
    const checked = new Map<string, number>();

    for (const path of INDEXABLE) {
      await page.goto(path);

      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((links) =>
          links
            .map((link) => link.getAttribute('href') ?? '')
            .filter((href) => href.startsWith('/')),
        );

      for (const href of hrefs) {
        const target = href.split('#')[0] ?? '';
        if (target === '') continue;

        expect(known.has(target), `${path} links to ${target}, which is not a known route`).toBe(
          true,
        );

        if (!checked.has(target)) {
          checked.set(target, (await request.get(target)).status());
        }
        expect(checked.get(target), `${path} links to ${target}, which returns a non-200`).toBe(
          200,
        );
      }
    }

    // A run that silently checked nothing would pass every assertion above.
    expect(checked.size).toBeGreaterThanOrEqual(known.size - 1);
  });
});
