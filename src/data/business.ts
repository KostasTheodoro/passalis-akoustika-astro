/**
 * The single source of truth for the business's identity and contact details.
 *
 * The legacy site held these in three places that had drifted apart — `lib/seo.ts`, the
 * navbar, and the contact page — with two different telephone link formats and two different
 * ways of writing the street. Nothing outside this file should hard-code any of it.
 */
export const BUSINESS = {
  /** Display name, used in headings, metadata and structured data. */
  name: 'Πασσαλής Ακουστικά',
  legalName: 'Passalis Hearing Aids',

  /**
   * The registered name of the business, as it appears on invoices and in ΓΕΜΗ.
   *
   * **This is a placeholder and must be replaced before production.** The privacy notice names it as
   * the data controller, which is the first thing GDPR Article 13 asks a notice to say, and a
   * trading name does not identify a legal person. The Google listing shows `ΠΑΣΣΑΛΗΣ Η. -
   * ΑΚΟΥΣΤΙΚΑ ΒΑΡΗΚΟΪΑΣ`, but a listing name is not a registered name and guessing on a legal notice
   * is worse than leaving this obvious.
   *
   * Changing it is one string. Nothing else has to move.
   */
  legalEntityName: 'Πασσαλής Ακουστικά',

  /**
   * Canonical production URL, without a trailing slash. STEP-09 decides how preview
   * deployments override this via `PUBLIC_SITE_URL`.
   */
  canonicalUrl: 'https://passalis-akoustika.gr',
  locale: 'el_GR',
  language: 'el',

  /**
   * One telephone number in three forms. `display` and `href` are exactly what the live site
   * already shows and links to; `international` is never displayed and exists only because
   * schema.org expects an international format (used from STEP-09).
   */
  telephone: {
    display: '210 612 9896',
    href: 'tel:2106129896',
    international: '+302106129896',
  },

  email: 'akoustika.passalis@gmail.com',

  address: {
    /** Written with a comma, as the navbar and contact page already render it. */
    street: 'Δολιανής 74, Λεωφ. Κηφισίας 127',
    locality: 'Μαρούσι',
    postalCode: '151 24',
    countryCode: 'GR',
  },

  /**
   * From the business's Google listing. Nothing renders this yet — STEP-07/08 decide whether
   * the footer or contact page shows it, and STEP-09 uses the machine form for
   * `openingHoursSpecification`.
   */
  openingHours: {
    display: 'Δευτέρα – Παρασκευή, 09:00 – 17:00',
    machine: [
      {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '17:00',
      },
    ],
  },

  /** Not currently displayed anywhere; recorded for local SEO in STEP-09. */
  serviceArea: 'Μαρούσι και βόρεια προάστια Αθηνών',
} as const;

/** Full address on one line, for structured data and single-line displays. */
export const fullAddress = `${BUSINESS.address.street}, ${BUSINESS.address.locality} ${BUSINESS.address.postalCode}`;
