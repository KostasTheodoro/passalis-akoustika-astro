import { expect, test } from '@playwright/test';
import { BUSINESS, fullAddress } from '../../src/data/business';
import { PRIMARY_NAV } from '../../src/data/navigation';

/**
 * The global shell, exercised the way it is actually used.
 *
 * Three of these guard defects STEP-00 found on the live site and that this step exists to fix:
 * the nested `<main>` landmarks, the desktop submenus that cannot be reached without a mouse, and
 * a drawer that leaves focus behind on the trigger.
 */

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.describe('landmarks and headings', () => {
  test.use({ viewport: DESKTOP });

  test('there is exactly one of each landmark', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('every navigation landmark has an accessible name', async ({ page }) => {
    await page.goto('/');

    const names = await page
      .locator('nav')
      .evaluateAll((navs) => navs.map((nav) => nav.getAttribute('aria-label')));

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name?.trim()).toBeTruthy();
    }
  });
});

test.describe('skip link', () => {
  test.use({ viewport: DESKTOP });

  test('is the first thing you reach and it moves focus into main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skip = page.getByRole('link', { name: 'Μετάβαση στο κύριο περιεχόμενο' });
    await expect(skip).toBeFocused();
    // It has to become visible when focused, or it cannot be used by a sighted keyboard user.
    await expect(skip).toBeInViewport();

    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });
});

test.describe('desktop navigation', () => {
  test.use({ viewport: DESKTOP });

  test('submenus open by keyboard, and every child link is reachable', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Άνοιγμα υπομενού: Ακουστικά' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const children = PRIMARY_NAV.find((item) => item.children)?.children ?? [];
    expect(children.length).toBeGreaterThan(0);

    for (const child of children) {
      await expect(page.locator(`nav a[href="${child.href}"]`).first()).toBeVisible();
    }
  });

  test('Escape closes the submenu and hands focus back to the toggle', async ({ page }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Άνοιγμα υπομενού: Συνεργάτες' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('the section a page belongs to is marked by more than colour', async ({ page }) => {
    await page.goto('/');

    // Home is reached through the logo, so nothing in the nav is current here — but the logo is
    // still a link home with a real accessible name.
    await expect(page.getByRole('link', { name: /αρχική σελίδα/ }).first()).toBeVisible();
  });
});

test.describe('mobile drawer', () => {
  test.use({ viewport: MOBILE });

  test('opens, traps focus, and locks the page behind it', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Άνοιγμα μενού' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('dialog[open]')).toBeVisible();

    const focusInside = await page.evaluate(
      () => document.querySelector('dialog')?.contains(document.activeElement) ?? false,
    );
    expect(focusInside).toBe(true);

    const overflow = await page.evaluate(() => document.documentElement.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('Escape closes it and returns focus to the trigger', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByRole('button', { name: 'Άνοιγμα μενού' });
    await trigger.click();
    await page.keyboard.press('Escape');

    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  });

  test('choosing a destination closes it', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Άνοιγμα μενού' }).click();
    await page.locator('dialog a[href="/epikoinonia"]').click();

    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });
});

test.describe('header scroll behaviour', () => {
  test.use({ viewport: DESKTOP });

  /**
   * The shell has to behave on a long page, and no long page exists yet — STEP-05 onward supply
   * those. Rather than test against a scaffold route that never ships, each of these adds the
   * height it needs to the real home page.
   */
  const givePageRoomToScroll = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '250vh';
      document.querySelector('main')?.append(spacer);
    });

  test('hides on the way down and comes back on the way up', async ({ page }) => {
    await page.goto('/');
    await givePageRoomToScroll(page);

    const header = page.locator('[data-site-header]');
    await expect(header).toHaveAttribute('data-header-state', 'top');

    await page.mouse.wheel(0, 1200);
    await expect(header).toHaveAttribute('data-header-state', 'hidden');

    await page.mouse.wheel(0, -300);
    await expect(header).toHaveAttribute('data-header-state', 'visible');

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveAttribute('data-header-state', 'top');
  });

  test('a hidden header comes back when keyboard focus enters it', async ({ page }) => {
    await page.goto('/');
    await givePageRoomToScroll(page);

    const header = page.locator('[data-site-header]');
    await page.mouse.wheel(0, 1200);
    await expect(header).toHaveAttribute('data-header-state', 'hidden');

    await page.locator('[data-site-header] a').first().focus();
    await expect(header).toHaveAttribute('data-header-state', 'visible');
  });

  test('hiding and revealing does not change the page height', async ({ page }) => {
    await page.goto('/');

    const heights = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('[data-site-header]');
      if (!header) return [];

      return (['top', 'hidden', 'visible'] as const).map((state) => {
        header.dataset.headerState = state;
        return document.documentElement.scrollHeight;
      });
    });

    expect(new Set(heights).size).toBe(1);
  });
});

test.describe('focus is always visible', () => {
  test.use({ viewport: DESKTOP });

  test('every focusable control in the shell draws an outline', async ({ page }) => {
    await page.goto('/');

    const widths = await page.evaluate(() => {
      const focusable = document.querySelectorAll<HTMLElement>(
        'header a, header button, footer a, main a, main button',
      );

      return [...focusable].map((element) => {
        element.focus();
        const style = getComputedStyle(element);
        // `:focus-visible` does not apply to a programmatic focus in every engine, so the rule is
        // read off the stylesheet rather than off the element's current computed state.
        return { tag: element.tagName, outline: style.outlineWidth };
      });
    });

    expect(widths.length).toBeGreaterThan(0);

    const rule = await page.evaluate(() =>
      [...document.styleSheets]
        .flatMap((sheet) => {
          try {
            return [...sheet.cssRules].map((r) => r.cssText);
          } catch {
            return [];
          }
        })
        .some((text) => text.includes('focus-visible') && text.includes('outline')),
    );

    expect(rule, 'no :focus-visible outline rule is present').toBe(true);
  });
});

test.describe('footer', () => {
  test.use({ viewport: DESKTOP });

  test('renders the business name and the year', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('footer')).toContainText(
      `© ${new Date().getFullYear()} ${BUSINESS.name}`,
    );
  });

  /**
   * The footer carried the opening hours, telephone, email and address until STEP-05, when the
   * maintainer removed them: the home page's closing band renders the same four values, and
   * repeating them under every page was too much of the same thing.
   *
   * This is the guard on that decision. `home.spec.ts` asserts the same values are present in the
   * band, so the site still shows each of them exactly once per page that needs them.
   */
  test('no longer repeats the contact details the home page already carries', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');

    await expect(footer.locator(`a[href="${BUSINESS.telephone.href}"]`)).toHaveCount(0);
    await expect(footer.locator(`a[href="mailto:${BUSINESS.email}"]`)).toHaveCount(0);
    await expect(footer).not.toContainText(fullAddress);
    await expect(footer).not.toContainText(BUSINESS.openingHours.display);
  });

  test('every primary navigation destination is reachable from the footer', async ({ page }) => {
    await page.goto('/');

    for (const item of PRIMARY_NAV) {
      await expect(page.locator(`footer a[href="${item.href}"]`)).toHaveCount(1);
    }
  });
});

test.describe('layout holds at every supported width', () => {
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

/**
 * The shell's own cross-origin guard lives in `home.spec.ts`, which asserts the same thing about
 * the same route. It is not repeated here.
 */
