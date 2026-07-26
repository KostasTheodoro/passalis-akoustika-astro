import { describe, expect, test } from 'bun:test';
import { BUSINESS, fullAddress } from '@/data/business';
import { HOME } from '@/data/home';
import { FOOTER_NAV, PRIMARY_NAV } from '@/data/navigation';
import { ROUTES } from '@/data/routes';

describe('business details', () => {
  test('the three telephone forms describe the same number', () => {
    // `BUSINESS` is `as const`, so these are widened to compare against a built string.
    const href: string = BUSINESS.telephone.href;
    const international: string = BUSINESS.telephone.international;
    const digits = BUSINESS.telephone.display.replace(/\s/g, '');

    expect(href).toBe(`tel:${digits}`);
    expect(international).toBe(`+30${digits}`);
  });

  test('the international telephone form is valid E.164', () => {
    expect(BUSINESS.telephone.international).toMatch(/^\+[1-9]\d{7,14}$/);
  });

  test('the email address is well formed', () => {
    expect(BUSINESS.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  test('the canonical URL is absolute, https, and has no trailing slash', () => {
    expect(BUSINESS.canonicalUrl).toMatch(/^https:\/\//);
    expect(BUSINESS.canonicalUrl).not.toMatch(/\/$/);
    expect(() => new URL(BUSINESS.canonicalUrl)).not.toThrow();
  });

  test('the full address combines street, locality and postal code', () => {
    expect(fullAddress).toContain(BUSINESS.address.street);
    expect(fullAddress).toContain(BUSINESS.address.locality);
    expect(fullAddress).toContain(BUSINESS.address.postalCode);
  });

  test('opening hours are well formed and open before they close', () => {
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;

    for (const block of BUSINESS.openingHours.machine) {
      expect(block.days.length).toBeGreaterThan(0);
      expect(block.opens).toMatch(time);
      expect(block.closes).toMatch(time);
      expect(block.opens < block.closes).toBe(true);
    }
  });
});

describe('navigation', () => {
  const knownRoutes = new Set<string>(Object.values(ROUTES));

  const primaryLinks = PRIMARY_NAV.flatMap((item) => [item, ...(item.children ?? [])]);
  const footerLinks = FOOTER_NAV.flatMap((group) => group.links);

  test('every navigation link points at a known route', () => {
    for (const link of [...primaryLinks, ...footerLinks]) {
      expect(knownRoutes).toContain(link.href);
    }
  });

  test('every navigation link has a non-empty label', () => {
    for (const link of [...primaryLinks, ...footerLinks]) {
      expect(link.label.trim().length).toBeGreaterThan(0);
    }
  });

  test('every category route is reachable from the primary navigation', () => {
    const categoryRoutes = [
      ROUTES.hearingAidsCic,
      ROUTES.hearingAidsRechargeable,
      ROUTES.hearingAidsRic,
      ROUTES.hearingAidsBte,
    ];
    const reachable = new Set(primaryLinks.map((link) => link.href));

    for (const route of categoryRoutes) {
      expect(reachable).toContain(route);
    }
  });

  test('no route is listed twice in the primary navigation', () => {
    const hrefs = primaryLinks.map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test('the footer has the two link groups the layout renders', () => {
    // The footer's third column is the address, telephone and opening hours, which come from
    // `BUSINESS` rather than from here. A third group would put a column where there is none.
    expect(FOOTER_NAV).toHaveLength(2);

    for (const group of FOOTER_NAV) {
      expect(group.heading.trim().length).toBeGreaterThan(0);
      expect(group.links.length).toBeGreaterThan(0);
    }
  });

  test('no route is listed twice in the footer', () => {
    const hrefs = footerLinks.map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test('every primary destination is also reachable from the footer', () => {
    const reachable = new Set(footerLinks.map((link) => link.href));

    for (const link of primaryLinks) {
      expect(reachable, `${link.label} is in the header but not the footer`).toContain(link.href);
    }
  });

  test('the header and the footer agree on what each route is called', () => {
    // With one deliberate exception per group: the link to a section's own index sits under a
    // heading that already names the section, so `/akoustika` reads `Ακουστικά` in the header and
    // `Όλοι οι τύποι` beneath the footer heading `Ακουστικά`. Anywhere else, a route that goes by
    // two different names in two different places is drift.
    const sectionRoots = new Set<string>(FOOTER_NAV.map((group) => group.links[0]?.href ?? ''));
    const footerLabels = new Map(footerLinks.map((link) => [link.href, link.label]));

    for (const link of primaryLinks) {
      if (sectionRoots.has(link.href)) continue;

      const footerLabel = footerLabels.get(link.href);
      if (footerLabel) expect(footerLabel, `${link.href} is named twice`).toBe(link.label);
    }
  });
});

describe('home page copy', () => {
  test('there are exactly four service cards, each with a distinct icon', () => {
    expect(HOME.services.cards).toHaveLength(4);

    const icons = HOME.services.cards.map((card) => card.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  test('every call to action points at a known route', () => {
    const knownRoutes = new Set<string>(Object.values(ROUTES));

    for (const cta of [
      HOME.hero.primaryCta,
      HOME.hero.secondaryCta,
      HOME.services.cta,
      HOME.featured.cta,
      HOME.contact.cta,
    ]) {
      expect(knownRoutes).toContain(cta.href);
    }
    expect(knownRoutes).toContain(HOME.eopyyCard.href);
  });

  test('the two ways to reach contact from the home page agree on where it is', () => {
    // The hero button and the closing band are the same journey twice, deliberately. If one of
    // them is ever dropped, the other must still be the contact route.
    expect(HOME.hero.primaryCta.href).toBe(ROUTES.contact);
    expect(HOME.contact.cta.href).toBe(ROUTES.contact);
  });

  test('the hero keeps the FAQ button the live site has', () => {
    expect(HOME.hero.secondaryCta.href).toBe(ROUTES.faq);
  });

  test('the closing band has something to say', () => {
    expect(HOME.contact.heading.trim().length).toBeGreaterThan(0);
    expect(HOME.contact.description.trim().length).toBeGreaterThan(0);
    // It must not promise an appointment the business cannot take online.
    expect(HOME.contact.description).not.toMatch(/ραντεβού|κράτηση/);
  });

  test('the EOPYY card does not hard-code the subsidy amount', () => {
    const card = JSON.stringify(HOME.eopyyCard);
    expect(card).not.toMatch(/\d{3}\s*€/);
  });
});
