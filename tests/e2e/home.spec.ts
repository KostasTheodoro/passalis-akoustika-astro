import { expect, test } from '@playwright/test';

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
