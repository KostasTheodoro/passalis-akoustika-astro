import { ROUTES, type RoutePath } from '@/data/routes';

/**
 * When each route's content last actually changed.
 *
 * The live site gives all twelve URLs one identical `lastmod` — the build time, from a
 * `new Date()` evaluated while generating the sitemap. That is not a modification date, it is a
 * deployment date, and a sitemap whose dates all move together on every deploy teaches Google to
 * ignore them.
 *
 * So these are curated by hand, and the maintainer chose that over the alternatives: omitting the
 * dates entirely, or deriving them from git, which reads the wrong date whenever a shallow clone
 * has not fetched the commit that last touched a file.
 *
 * **Update the date when a route's visible content changes**, not when its markup or styling does.
 * A new paragraph counts; a refactor does not. `satisfies Record<RoutePath, string>` makes a
 * missing route a compile error, so a new page cannot be added without deciding its date.
 *
 * The dates below are the days each route's content was last edited, from the step history:
 * STEP-05 built the home page and STEP-06 the catalogue on 2026-07-26; STEP-07 built the five
 * informational routes on 2026-07-27; STEP-08 built contact and privacy on 2026-07-27; STEP-09
 * rewrote every `seo.title` and added the contact page's service-area sentence on 2026-07-28.
 */
export const LAST_MODIFIED = {
  [ROUTES.home]: '2026-07-26',
  [ROUTES.hearingAids]: '2026-07-26',
  [ROUTES.hearingAidsCic]: '2026-07-26',
  [ROUTES.hearingAidsRechargeable]: '2026-07-26',
  [ROUTES.hearingAidsRic]: '2026-07-26',
  [ROUTES.hearingAidsBte]: '2026-07-26',
  [ROUTES.partners]: '2026-07-27',
  [ROUTES.eopyy]: '2026-07-27',
  [ROUTES.providers]: '2026-07-27',
  [ROUTES.about]: '2026-07-27',
  [ROUTES.faq]: '2026-07-27',
  /** The one route whose visible copy STEP-09 changed: the service-area sentence. */
  [ROUTES.contact]: '2026-07-28',
  [ROUTES.privacy]: '2026-07-27',
} satisfies Record<RoutePath, string>;

/**
 * Every route the sitemap lists, in the order `ROUTES` declares them.
 *
 * `/404` is not a route and `/api/contact` is not a page, so neither appears here — `ROUTES` holds
 * only indexable public paths, which is what makes it the right source.
 */
export const SITEMAP_ROUTES: RoutePath[] = Object.values(ROUTES);
