/**
 * Every public path on the site, in one place.
 *
 * `RoutePath` is the union of these values, so navigation entries, calls to action and
 * internal links are checked at compile time. A link to a route that does not exist is a type
 * error rather than a broken page.
 *
 * The four category paths are derived from the `hearing-types` collection ids;
 * `tests/unit/content-integrity.test.ts` asserts the two stay in step.
 */
export const ROUTES = {
  home: '/',
  hearingAids: '/akoustika',
  hearingAidsCic: '/akoustika/cic',
  hearingAidsRechargeable: '/akoustika/rechargeable',
  hearingAidsRic: '/akoustika/ric',
  hearingAidsBte: '/akoustika/bte',
  partners: '/synergates',
  eopyy: '/synergates/eopyy',
  providers: '/synergates/paroxoi',
  about: '/sxetika-me-mas',
  faq: '/syxnes-erotiseis',
  contact: '/epikoinonia',
  /**
   * New in STEP-08. The legacy site has no privacy page at all, which is why this is the one route
   * here that is not a preserved URL. The slug is the transliteration the route-parity matrix
   * proposed in STEP-00.
   */
  privacy: '/politiki-aporritou',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** Builds a category path from a `hearing-types` entry id. */
export function hearingTypePath(id: string): string {
  return `${ROUTES.hearingAids}/${id}`;
}
