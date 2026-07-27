import { BUSINESS } from '@/data/business';
import { ROUTES } from '@/data/routes';

/**
 * Everything the contact page and its form say, in one place.
 *
 * The form is the only part of the site that exists in two runtimes at once: a React island in the
 * browser and an endpoint on a server. Both import this file and
 * `src/lib/forms/contact-schema.ts`, which is what stops them disagreeing. The legacy site is the
 * cautionary tale: its client form marked `lastName` required while its API validated only
 * `firstName`, `email` and `message`, so a submission the visitor could not make by hand was
 * accepted by the server.
 *
 * Labels, placeholders and the button are the live site's own words, unchanged. What is new is the
 * enquiry type, the privacy acknowledgement, the health-data hint and every status message, because
 * the legacy form had none of them.
 */

/**
 * The five enquiry types, in the order they appear in the menu.
 *
 * The **value** is a stable ASCII slug and the **label** is what a visitor reads. They are separate
 * on purpose: the value travels in the payload, keys the email subject and would key any future
 * reporting, so rewording a label must never change what was recorded. It also keeps Greek out of
 * places that would have to be URL-encoded or matched exactly.
 *
 * Declared as a tuple of values first so the schema's enum and the label map are checked against
 * each other by the compiler: adding a value without a label is a type error.
 */
export const ENQUIRY_TYPE_VALUES = [
  'hearing-test',
  'hearing-aids',
  'eopyy',
  'service',
  'other',
] as const;

export type EnquiryTypeValue = (typeof ENQUIRY_TYPE_VALUES)[number];

/**
 * Fully Greek, by maintainer decision during STEP-08 planning. The specification's starting set
 * wrote the fourth as `Service / ρύθμιση ακουστικού`, which mixes scripts in a way nothing else on
 * the site does.
 */
export const ENQUIRY_TYPE_LABELS: Record<EnquiryTypeValue, string> = {
  'hearing-test': 'Τεστ ακοής',
  'hearing-aids': 'Ακουστικά βαρηκοΐας',
  eopyy: 'Πληροφορίες για ΕΟΠΥΥ',
  service: 'Επισκευή ή ρύθμιση ακουστικού',
  other: 'Άλλη ερώτηση',
};

/** The menu, in display order. Derived so the order lives in exactly one place. */
export const ENQUIRY_TYPES = ENQUIRY_TYPE_VALUES.map((value) => ({
  value,
  label: ENQUIRY_TYPE_LABELS[value],
}));

/**
 * Length limits, shared by the schema and by the `maxlength` attributes on the controls.
 *
 * The browser stops a visitor overrunning; the server is what actually enforces it. Both read these
 * numbers, so a limit cannot be tightened in one place and left in the other.
 */
export const FIELD_LIMITS = {
  name: 60,
  /** The maximum length of an address permitted by RFC 5321. */
  email: 254,
  telephone: 30,
  messageMin: 10,
  messageMax: 2000,
} as const;

/**
 * What counts as a telephone number.
 *
 * Deliberately permissive: digits, spaces, `+`, `()` and hyphens, which is how people actually
 * write Greek numbers. The legacy form stripped every non-digit as the visitor typed, so
 * `+30 210 612 9896` silently became `302106129896` under their cursor.
 */
export const TELEPHONE_PATTERN = /^[\d+()\-\s]{5,30}$/;

/** Error text. Each names the field, so a screen reader announcing one alone still makes sense. */
export const CONTACT_ERRORS = {
  firstName: 'Συμπληρώστε το όνομά σας.',
  lastName: 'Συμπληρώστε το επώνυμό σας.',
  email: 'Συμπληρώστε ένα έγκυρο email.',
  emailTooLong: 'Το email είναι πολύ μεγάλο.',
  telephone: 'Το τηλέφωνο δεν φαίνεται έγκυρο.',
  enquiryType: 'Επιλέξτε θέμα.',
  message: 'Γράψτε το μήνυμά σας.',
  messageTooShort: 'Γράψτε λίγο περισσότερα, για να μπορέσουμε να σας απαντήσουμε σωστά.',
  messageTooLong: `Το μήνυμα δεν μπορεί να ξεπερνά τους ${FIELD_LIMITS.messageMax} χαρακτήρες.`,
  nameTooLong: `Δεν μπορεί να ξεπερνά τους ${FIELD_LIMITS.name} χαρακτήρες.`,
  privacy: 'Πρέπει να αποδεχτείτε την Πολιτική Απορρήτου.',
} as const;

export const CONTACT = {
  seo: {
    /**
     * No brand suffix. STEP-09 owns the title template that appends it once, centrally, which is
     * the fix for the legacy `/synergates` title that read the site name twice.
     */
    title: 'Επικοινωνία',
    /**
     * The live site's description reads `Επικοινωνήστε με μαζί μας.` with a stray `με` and a double
     * space before the address. Recorded as a defect in `content-migration-inventory.md` and
     * assigned here.
     */
    description: `Επικοινωνήστε μαζί μας για ακουστικά βαρηκοΐας, έλεγχο ακοής και υποστήριξη στο ${BUSINESS.address.locality}. Τηλέφωνο, email, φόρμα και χάρτης.`,
    keywords: [
      'επικοινωνία ακουστικά βαρηκοΐας',
      'ακουστικά βαρηκοΐας Μαρούσι',
      'έλεγχος ακοής Μαρούσι',
    ],
  },

  heading: 'Επικοινωνία',

  /**
   * The live site's paragraph, with one word removed.
   *
   * Production says `Συμπληρώστε την παρακάτω φόρμα`. On this layout the form sits *beside* the
   * text above 1024px and below it under that, so `παρακάτω` is wrong on half the screens it is
   * read on. Maintainer instruction during STEP-08's review; recorded because DEC-008 preserves the
   * client's copy by default and every departure has to be listed.
   */
  intro:
    'Η ομάδα μας είναι πάντα στη διάθεσή σας για να απαντήσει σε κάθε σας ερώτηση για τα προϊόντα και τις υπηρεσίες μας. Συμπληρώστε τη φόρμα ή επικοινωνήστε μαζί μας μέσω τηλεφώνου ή email.',

  form: {
    /** Names the form for assistive technology, since the page has no second form to confuse it. */
    label: 'Φόρμα επικοινωνίας',
    submit: 'Αποστολή μηνύματος',
    submitting: 'Γίνεται αποστολή...',

    /** Marks the one optional control, in text rather than by its absence from the others. */
    optional: '(προαιρετικό)',
    /** Explains the asterisk once, above the fields, so it is not left to be inferred. */
    requiredNote: 'Τα πεδία με αστερίσκο είναι υποχρεωτικά.',

    fields: {
      firstName: { label: 'Όνομα', placeholder: 'Το όνομά σας' },
      lastName: { label: 'Επώνυμο', placeholder: 'Το επώνυμό σας' },
      email: { label: 'Email', placeholder: 'Το email σας' },
      telephone: { label: 'Τηλέφωνο', placeholder: 'π.χ. 2106129896' },
      enquiryType: { label: 'Θέμα επικοινωνίας', placeholder: 'Επιλέξτε θέμα' },
      message: { label: 'Μήνυμα', placeholder: 'Γράψτε το μήνυμά σας εδώ...' },
    },

    /**
     * Sits under the message box, where somebody is about to type.
     *
     * This is a hearing-aid shop, so a free-text message can easily carry health information, which
     * the GDPR treats as a special category with a much higher bar than an ordinary name and email.
     * The honest fix is to ask for less, not to write a longer notice: the shop can discuss it by
     * telephone or in person, where it belongs.
     */
    messageHint:
      'Μην γράφετε ιατρικά στοιχεία εδώ. Θα τα δούμε μαζί στο τηλέφωνο ή από κοντά στο κατάστημα.',

    /** Split so the template can put a real link inside the label without parsing a string. */
    privacy: {
      before: 'Έχω διαβάσει και αποδέχομαι την ',
      linkLabel: 'Πολιτική Απορρήτου',
      linkHref: ROUTES.privacy,
      after: '.',
    },

    /**
     * The honeypot's visible name. It is hidden from everybody, but a field with no label at all is
     * exactly what a smarter bot looks for, so it carries a plausible one.
     */
    honeypotLabel: 'Ιστότοπος',
  },

  status: {
    /**
     * Promises an answer but never a time. `forms-and-email.md` is explicit: the acknowledgement
     * must not commit the shop to a response time nobody has agreed to.
     */
    successTitle: 'Το μήνυμά σας στάλθηκε.',
    successBody: 'Θα σας απαντήσουμε στο email που μας δώσατε.',

    /** Every failure offers the telephone, because the form is the part that just failed. */
    errorTitle: 'Το μήνυμα δεν στάλθηκε.',
    errorBody: `Δοκιμάστε ξανά ή τηλεφωνήστε μας στο ${BUSINESS.telephone.display}.`,

    rateLimitedTitle: 'Πολλές προσπάθειες σε μικρό διάστημα.',
    rateLimitedBody: `Δοκιμάστε ξανά σε λίγο ή τηλεφωνήστε μας στο ${BUSINESS.telephone.display}.`,

    /**
     * Shown when the server accepted the message but no email was sent, because no Resend key is
     * configured. It must never read as success: a developer seeing a green tick for a message that
     * went nowhere is how a broken contact form reaches production.
     */
    developmentTitle: 'Λειτουργία ανάπτυξης: το μήνυμα δεν στάλθηκε.',
    developmentBody: 'Δεν έχει ρυθμιστεί κλειδί αποστολής, οπότε δεν έφυγε κανένα email.',

    /** Announced when client validation blocks the submit, so the failure is not silent. */
    invalid: 'Ελέγξτε τα πεδία με σφάλμα και δοκιμάστε ξανά.',
  },

  map: {
    heading: 'Πού θα μας βρείτε',
    /** The button that loads the embed. Nothing reaches Google before it is pressed. */
    load: 'Άνοιγμα χάρτη',
    /** Explains why there is a button rather than a map, without jargon. */
    note: 'Ο χάρτης φορτώνει από την Google μόλις τον ανοίξετε.',
    externalLabel: 'Άνοιγμα στους Χάρτες Google',
  },
} as const;
