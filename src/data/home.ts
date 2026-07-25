import { ROUTES, type RoutePath } from '@/data/routes';

/**
 * Home page copy, gathered from the five legacy components that each held their own strings
 * (`Hero`, `ServicesSection`, `Eoppy`, `Favorites`, `SigniaApp`).
 *
 * Structure and wording only. Layout, icons and imagery are the templates' business in
 * STEP-05; `icon` here is a key the template maps to a component, not a component itself.
 * The EOPYY amount is deliberately absent — it comes from the `eopyy` page entry, which is
 * the single source for that figure.
 */

export interface ServiceCard {
  icon: 'hearing-test' | 'custom-fit' | 'warranty' | 'support';
  title: string;
  description: string;
}

interface CallToAction {
  label: string;
  href: RoutePath;
}

export const HOME = {
  seo: {
    title: 'Ακουστικά Βαρηκοΐας στο Μαρούσι – Πασσαλής Ακουστικά',
    description:
      'Δωρεάν έλεγχος ακοής, εξατομικευμένη εφαρμογή και πλήρη υποστήριξη μετά την αγορά. Ακουστικά βαρηκοΐας στο Μαρούσι με συμμετοχή ΕΟΠΥΥ 450€.',
    keywords: ['ακουστικά βαρηκοΐας Μαρούσι', 'έλεγχος ακοής', 'ΕΟΠΥΥ ακουστικά'],
  },

  hero: {
    heading: 'Καλωσήρθατε στα ακουστικά βαρηκοΐας Πασσαλής',
    subheading:
      'Είμαστε εδώ για να σας βοηθήσουμε με όλες τις απορίες σας για τα ακουστικά βαρηκοΐας',
    cta: { label: 'Συχνές Ερωτήσεις', href: ROUTES.faq } satisfies CallToAction,
    /** Legacy sources. STEP-03 replaces these with optimized responsive derivatives. */
    imageSources: { desktop: '/hero.png', mobile: '/hero-mobile.jpg' },
  },

  services: {
    heading: 'Γιατί να μας επιλέξετε',
    cta: { label: 'Ανακαλύψτε την ιστορία μας', href: ROUTES.about } satisfies CallToAction,
    cards: [
      {
        icon: 'hearing-test',
        title: 'Δωρεάν Έλεγχος Ακοής',
        description: 'Πλήρης αξιολόγηση της ακοής σας με σύγχρονο εξοπλισμό, χωρίς καμία χρέωση.',
      },
      {
        icon: 'custom-fit',
        title: 'Προσαρμοσμένα Ακουστικά',
        description: 'Κατασκευή και ρύθμιση ακουστικών βαρηκοΐας ειδικά φτιαγμένα για εσάς.',
      },
      {
        icon: 'warranty',
        title: 'Εγγύηση & Συντήρηση',
        // Corrected to match the FAQ, which the maintainer confirmed is the accurate claim.
        // The legacy text promised free service for the lifetime of the equipment.
        description: 'Διετής εγγύηση ποιότητας και συντήρηση για 3 χρόνια.',
      },
      {
        icon: 'support',
        title: 'Συνεχής Υποστήριξη',
        description:
          'Πλήρης υποστήριξη μετά την αγορά: ρυθμίσεις, συμβουλές και ό,τι άλλο χρειαστείτε.',
      },
    ] satisfies ServiceCard[],
  },

  /** The amount itself comes from the `eopyy` page entry's `subsidy` frontmatter. */
  eopyyCard: {
    headline: 'Επιδότηση από το ταμείο σας!',
    note: 'Καταβάλλετε μόνο τη συμμετοχή σας',
    logoSource: '/eopyy.png',
    logoAlt: 'ΕΟΠΥΥ',
    href: ROUTES.eopyy,
  },

  /** Renders the models marked `featured` in the `hearing-models` collection. */
  featured: {
    heading: 'Τα ακουστικά μας',
    cta: { label: 'Δείτε όλα τα ακουστικά', href: ROUTES.hearingAids } satisfies CallToAction,
  },

  signiaApp: {
    heading: 'Κατεβάστε το Signia App',
    body: [
      'Ελέγξτε και προσαρμόστε τα ακουστικά σας απευθείας από το κινητό σας τηλέφωνο.',
      'Το Signia App σας παρέχει έλεγχο, οδηγίες, υποστήριξη και πολλές ακόμα δυνατότητες, εύκολα και γρήγορα.',
    ],
    note: 'Διαθέσιμο για iOS και Android.',
    logoSource: '/signia-logo.png',
    logoAlt: 'Signia logo',
  },
} as const;
