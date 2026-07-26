import appStoreBadge from '@/assets/images/badges/appstore.svg';
import googlePlayBadge from '@/assets/images/badges/googleplay.png';
import heroDesktop from '@/assets/images/hero/hero-desktop.jpg';
import heroMobile from '@/assets/images/hero/hero-mobile.jpg';
import eopyyLogo from '@/assets/images/partners/eopyy.png';
import signiaLogo from '@/assets/images/partners/signia.png';
import { ROUTES, type RoutePath } from '@/data/routes';

/**
 * Home page copy, gathered from the five legacy components that each held their own strings
 * (`Hero`, `ServicesSection`, `Eoppy`, `Favorites`, `SigniaApp`).
 *
 * Structure and wording only. Layout is the templates' business in STEP-05; `icon` here is a key
 * the template maps to a component, not a component itself. The EOPYY amount is deliberately
 * absent — it comes from the `eopyy` page entry, which is the single source for that figure.
 *
 * Images are imported rather than named by path, so each one arrives as `ImageMetadata` with its
 * dimensions attached and a build fails loudly if a file is renamed or removed.
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
    /**
     * The live site's hero carries one button, to the FAQ. That button is unchanged and keeps its
     * place; the contact button is new, added on the maintainer's instruction in STEP-05, and
     * takes the primary role because contacting the business is where the whole page leads.
     */
    primaryCta: { label: 'Επικοινωνήστε μαζί μας', href: ROUTES.contact } satisfies CallToAction,
    secondaryCta: { label: 'Συχνές Ερωτήσεις', href: ROUTES.faq } satisfies CallToAction,
    /**
     * Two separate photographs, not one image at two sizes: the desktop frame is a wide
     * landscape and the mobile one is square, so STEP-05 needs a `<picture>` with a media
     * condition rather than a plain srcset.
     *
     * The hero carries no information the heading does not already state, so it is decorative
     * and takes an empty alt.
     */
    image: { desktop: heroDesktop, mobile: heroMobile },
    imageAlt: '',
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
    logo: eopyyLogo,
    logoAlt: 'Λογότυπο ΕΟΠΥΥ',
    href: ROUTES.eopyy,
  },

  /** Renders the models marked `featured` in the `hearing-models` collection. */
  featured: {
    heading: 'Τα ακουστικά μας',
    cta: { label: 'Δείτε όλα τα ακουστικά', href: ROUTES.hearingAids } satisfies CallToAction,
  },

  /**
   * The closing call to action, new in STEP-05 and the one section with no counterpart on the live
   * site. It names only what the site already offers — hearing test, hearing aids, EOPYY — and
   * avoids any booking verb, because there is no appointment system to book with.
   *
   * The telephone number is not repeated here: the template renders it from `BUSINESS`.
   */
  contact: {
    heading: 'Μιλήστε μαζί μας',
    /**
     * Two sentences. The second adds no claim the page does not already make: the free hearing
     * test and the modern equipment are the `hearing-test` service card's own words, and the
     * location is the address rendered beside this copy.
     */
    description:
      'Έχετε απορίες για τα ακουστικά βαρηκοΐας, τον έλεγχο ακοής ή τη συμμετοχή του ΕΟΠΥΥ; Στείλτε μας μήνυμα ή τηλεφωνήστε μας. Ο έλεγχος ακοής γίνεται χωρίς χρέωση, με σύγχρονο εξοπλισμό, στο κατάστημά μας στο Μαρούσι.',
    cta: { label: 'Επικοινωνήστε μαζί μας', href: ROUTES.contact } satisfies CallToAction,
  },

  signiaApp: {
    heading: 'Κατεβάστε το Signia App',
    body: [
      'Ελέγξτε και προσαρμόστε τα ακουστικά σας απευθείας από το κινητό σας τηλέφωνο.',
      'Το Signia App σας παρέχει έλεγχο, οδηγίες, υποστήριξη και πολλές ακόμα δυνατότητες, εύκολα και γρήγορα.',
    ],
    note: 'Διαθέσιμο για iOS και Android.',
    logo: signiaLogo,
    logoAlt: 'Λογότυπο Signia',
    /** Official store artwork, shipped exactly as supplied. Only the alt text is localized. */
    badges: {
      appStore: { image: appStoreBadge, alt: 'Κατεβάστε το από το App Store' },
      googlePlay: { image: googlePlayBadge, alt: 'Διαθέσιμο στο Google Play' },
    },
  },
} as const;
