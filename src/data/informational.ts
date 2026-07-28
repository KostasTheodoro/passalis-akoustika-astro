import { ROUTES, type RoutePath } from '@/data/routes';

/**
 * Page-level copy for the five informational routes, in the same shape `catalogue.ts` uses for the
 * five catalogue routes.
 *
 * Only strings that belong to a *page* live here. Everything these routes render about a subject
 * comes from the collections: the About and EOPYY prose from `pages`, the fourteen questions from
 * `faqs`, the four manufacturers from `providers`. About and EOPYY also carry their own `seo`
 * frontmatter, so neither appears in this file.
 *
 * The `/synergates` landing page has no collection entry of its own. It is two cards pointing at
 * the pages below it, so its copy is here rather than in a content file that nothing else would
 * ever read.
 *
 * Titles carry no brand suffix. The legacy template appended the site name to titles that already
 * contained it, which is the `/synergates` double-suffix defect recorded in
 * `content-migration-inventory.md`. STEP-09's `buildTitle` puts it back once, centrally, and
 * throws on any title that names the brand itself.
 *
 * **This file imports no images, and must not start.** `home.ts` imports its own, deliberately, so
 * that a renamed asset fails the build. The cost is that Playwright's transpiler is not Vite and
 * chokes on the first PNG, which is why `home.spec.ts` cannot import `home.ts` and asserts against
 * the rendered page instead. Keeping this file to strings means the informational suite can assert
 * against the real copy. The two partner logos are named by key here and resolved to real imports
 * in `synergates/index.astro`, so a renamed file still fails the build.
 */

interface CallToAction {
  label: string;
  href: RoutePath;
}

interface ContactBandCopy {
  heading: string;
  description: string;
  cta: CallToAction;
}

/** The two logos `/synergates` shows. The page maps each key to a real image import. */
export type PartnerLogo = 'eopyy' | 'signia';

interface PartnerCardCopy {
  title: string;
  description: string;
  logo: PartnerLogo;
  logoAlt: string;
  href: RoutePath;
}

/**
 * The one call to action every closing band uses. There is no booking verb anywhere, because there
 * is no appointment system to book with.
 */
const CONTACT_CTA: CallToAction = { label: 'Επικοινωνήστε μαζί μας', href: ROUTES.contact };

export const INFORMATIONAL = {
  about: {
    /**
     * The heading, prose, images and `seo` all come from `src/content/pages/about.mdx`. Only the
     * closing band is a page decision.
     */
    contact: {
      heading: 'Ελάτε να τα πούμε από κοντά',
      description:
        'Ο έλεγχος ακοής γίνεται χωρίς χρέωση, στο κατάστημά μας στο Μαρούσι. Τηλεφωνήστε μας ή στείλτε μας μήνυμα.',
      cta: CONTACT_CTA,
    } satisfies ContactBandCopy,
  },

  faq: {
    seo: {
      /** The legacy title without its `– Πασσαλής` suffix, which `buildTitle` re-applies. */
      title: 'Συχνές Ερωτήσεις',
      description:
        'Απαντήσεις σε συχνές ερωτήσεις για ακουστικά βαρηκοΐας: λειτουργία, διάρκεια ζωής, δοκιμή, επιδότηση ΕΟΠΥΥ, εγγύηση, επισκευή και ραντεβού, από το κατάστημά μας στο Μαρούσι.',
      keywords: [
        'συχνές ερωτήσεις ακουστικά βαρηκοΐας',
        'έλεγχος ακοής Μαρούσι',
        'ΕΟΠΥΥ ακουστικά βαρηκοΐας',
        'εγγύηση ακουστικών βαρηκοΐας',
      ],
    },
    heading: 'Συχνές Ερωτήσεις',
    contact: {
      heading: 'Δεν βρήκατε την απάντηση;',
      description: 'Στείλτε μας την ερώτησή σας ή τηλεφωνήστε μας. Απαντάμε ευχαρίστως.',
      cta: CONTACT_CTA,
    } satisfies ContactBandCopy,
  },

  partners: {
    seo: {
      title: 'Συνεργάτες: ΕΟΠΥΥ & Πάροχοι',
      description:
        'Ενημερωθείτε για την επιδότηση ΕΟΠΥΥ και δείτε τους επίσημους παρόχους ακουστικών βαρηκοΐας (Signia, Siemens, Rexton, A&M) στο Μαρούσι.',
      keywords: [
        'ΕΟΠΥΥ ακουστικά βαρηκοΐας',
        'πάροχοι ακουστικών βαρηκοΐας',
        'ακουστικά βαρηκοΐας Μαρούσι',
      ],
    },
    heading: 'Οι Συνεργάτες μας',
    intro:
      'Εδώ θα βρείτε τι καλύπτει ο ΕΟΠΥΥ για τα ακουστικά βαρηκοΐας και ποιους κατασκευαστές εμπιστευόμαστε στο κατάστημά μας στο Μαρούσι.',

    /**
     * Two cards, as the live site has them. Both descriptions and the shared `Δείτε λεπτομέρειες`
     * label are the legacy wording, unchanged.
     *
     * The providers card is headed `Πάροχοι Βοηθημάτων Ακοής`, not the live site's
     * `Πάροχοι Ακουστικών Βαρηκοΐας`. The page it opens is headed `Πάροχοι Βοηθημάτων Ακοής` and
     * the navigation calls it that too, so the live site is the one place out of three using a
     * different name for the same page.
     */
    cards: [
      {
        title: 'ΕΟΠΥΥ',
        description:
          'Ενημερωθείτε για την επιδότηση του ΕΟΠΥΥ, τα δικαιολογητικά και τη διαδικασία αποζημίωσης για ακουστικά βαρηκοΐας.',
        /** Resolved to an imported `ImageMetadata` by the page. */
        logo: 'eopyy',
        logoAlt: 'Λογότυπο ΕΟΠΥΥ',
        href: ROUTES.eopyy,
      },
      {
        title: 'Πάροχοι Βοηθημάτων Ακοής',
        description:
          'Δείτε τους επίσημους παρόχους ακουστικών βαρηκοΐας με τους οποίους συνεργαζόμαστε, προσφέροντάς σας τις καλύτερες λύσεις για τις ανάγκες σας. Signia, A&M Hearing, Rexton και Siemens.',
        logo: 'signia',
        logoAlt: 'Λογότυπο Signia',
        href: ROUTES.providers,
      },
    ] satisfies readonly PartnerCardCopy[],

    /**
     * One label for both cards, as the live site has it. Two identical accessible names on one page
     * is the problem `HearingTypeCard` already solves, so the template appends each card's title as
     * visually hidden text.
     */
    cardCta: 'Δείτε λεπτομέρειες',

    contact: {
      heading: 'Θέλετε να μάθετε τι δικαιούστε;',
      description:
        'Πείτε μας τι σας ενδιαφέρει και σας ενημερώνουμε αναλυτικά για τη συμμετοχή του ΕΟΠΥΥ.',
      cta: CONTACT_CTA,
    } satisfies ContactBandCopy,
  },

  providers: {
    seo: {
      title: 'Πάροχοι: Signia, Siemens, Rexton',
      description:
        'Συνεργαζόμαστε με κορυφαίους οίκους: Signia, Siemens, Rexton, A&M. Καινοτομία, αξιοπιστία και υποστήριξη για κάθε ανάγκη ακοής.',
      keywords: ['Signia', 'Siemens', 'Rexton', 'A&M', 'πάροχοι ακουστικών βαρηκοΐας'],
    },
    heading: 'Πάροχοι Βοηθημάτων Ακοής',
    intro:
      'Συνεργαζόμαστε με τέσσερις οίκους του ομίλου WS Audiology, που είναι από τους μεγαλύτερους κατασκευαστές ακουστικών βαρηκοΐας στον κόσμο. Έτσι μπορούμε να προτείνουμε λύση για κάθε βαθμό απώλειας ακοής και για κάθε προϋπολογισμό.',
    /** Prefixes the manufacturer name on each card's outbound link. */
    websiteLabel: 'Επίσημος ιστότοπος',
    contact: {
      heading: 'Ποιο ακουστικό ταιριάζει σε εσάς;',
      description:
        'Κάθε οίκος έχει τα δυνατά του σημεία. Ελάτε για έλεγχο ακοής στο Μαρούσι και το βρίσκουμε μαζί.',
      cta: CONTACT_CTA,
    } satisfies ContactBandCopy,
  },
} as const;
