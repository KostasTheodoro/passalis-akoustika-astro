import { ROUTES, type RoutePath } from '@/data/routes';

/**
 * Catalogue copy: the listing page's own strings, and the contact band the five catalogue routes
 * share.
 *
 * Everything else these pages render comes from the `hearing-types` and `hearing-models`
 * collections — the four category titles, their descriptions, their per-category SEO strings and
 * all thirteen model names and descriptions. Nothing is duplicated here.
 *
 * The listing's heading, title and meta description are the legacy site's, verbatim from
 * `akoustika/page.tsx`. `seo.title` deliberately carries no brand suffix: STEP-02 stripped it out
 * of the category entries because the legacy template appended the site name to titles that
 * already contained it, which is the `/synergates` double-suffix defect. STEP-09 owns the title
 * template that puts it back, once, in one place.
 */

interface CallToAction {
  label: string;
  href: RoutePath;
}

export const CATALOGUE = {
  listing: {
    seo: {
      title: 'Τύποι Ακουστικών Βαρηκοΐας – CIC, RIC, BTE, Επαναφορτιζόμενα',
      description:
        'Δείτε όλους τους τύπους ακουστικών βαρηκοΐας: CIC, RIC, BTE και Charge&Go. Βρείτε τη σωστή λύση για τις ανάγκες και τον τρόπο ζωής σας.',
      keywords: ['CIC', 'RIC', 'BTE', 'Charge&Go'],
    },
    heading: 'Τύποι Ακουστικών Βαρηκοΐας',
    /**
     * The live site's own label on each category card. It is vague as link text on its own, and
     * four of them sit on one page, so `HearingTypeCard` appends the category name as visually
     * hidden text — the wording the client approved is what everyone sees, and a screen-reader
     * user still hears four distinct names.
     */
    cardCta: 'Δείτε περισσότερα',
  },

  /**
   * The closing band on the listing and on all four category pages. The live site has no link to
   * contact anywhere in the catalogue; `information-architecture.md` asks for one.
   *
   * It carries no telephone, email or address. STEP-05 took those out of the footer so the shop's
   * details stop repeating under every page, and putting them back on five more routes would undo
   * that. The contact page and the home page's band are where they live.
   *
   * Neither sentence makes a claim the site does not already make: the free hearing test and the
   * personal fitting are the home page's `hearing-test` and `custom-fit` service cards. There is
   * no booking verb, because there is no appointment system to book with.
   */
  contact: {
    heading: 'Χρειάζεστε βοήθεια να επιλέξετε;',
    description: 'Μιλήστε μαζί μας για δωρεάν έλεγχο ακοής και εξατομικευμένη εφαρμογή.',
    cta: { label: 'Επικοινωνήστε μαζί μας', href: ROUTES.contact } satisfies CallToAction,
  },
} as const;
