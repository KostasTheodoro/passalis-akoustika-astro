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
   * Canonical production URL, without a trailing slash.
   *
   * Every canonical, Open Graph URL and sitemap entry is built from this, on every build,
   * previews included. `PUBLIC_SITE_URL` deliberately does not override it: a preview that
   * canonicalised to itself would be asking Google to index the preview.
   */
  canonicalUrl: 'https://passalis-akoustika.gr',
  locale: 'el_GR',
  language: 'el',

  /**
   * One telephone number in three forms. `display` and `href` are exactly what the live site
   * already shows and links to; `international` is never displayed and exists only because
   * schema.org expects an international format, which is what `HearingAidStore` emits.
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
   * The shop's own coordinates, read off the Google Maps *place* URL in `external-links.ts`
   * (`!3d38.0483082!4d23.807228`), which is the business's own listing rather than a lookup.
   *
   * Note this is the marker, not the embed's centre: the iframe URL carries a slightly different
   * longitude because it describes where the map is framed, not where the shop is.
   */
  geo: {
    latitude: 38.0483082,
    longitude: 23.807228,
  },

  /**
   * From the business's Google listing. The display form is not rendered anywhere; the machine
   * form becomes `openingHoursSpecification` in the `HearingAidStore` markup.
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

  /** The prose form, used in body copy. */
  serviceArea: 'Μαρούσι και βόρεια προάστια Αθηνών',

  /**
   * The same service area as discrete places, for `areaServed` in the `HearingAidStore` markup.
   *
   * Confirmed by the maintainer on 2026-07-28: *"service area is mainly Marousi and everything
   * around that"*. Every locality here is also named in the contact page's visible copy, and
   * `tests/unit/data.test.ts` asserts that, because structured data describing places the site
   * never mentions is the kind of unverified claim `specifications/seo.md` rules out. Adding a
   * name here means adding it to the sentence too.
   */
  serviceAreaPlaces: ['Μαρούσι', 'Κηφισιά', 'Χαλάνδρι', 'Μελίσσια', 'Βριλήσσια', 'Πεύκη'],
} as const;

/** Full address on one line, for structured data and single-line displays. */
export const fullAddress = `${BUSINESS.address.street}, ${BUSINESS.address.locality} ${BUSINESS.address.postalCode}`;
