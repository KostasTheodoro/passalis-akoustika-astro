import { ROUTES, type RoutePath } from '@/data/routes';

export interface NavLink {
  label: string;
  href: RoutePath;
}

export interface NavItem extends NavLink {
  /** Present on the two top-level items that open a dropdown. */
  children?: NavLink[];
}

/**
 * Primary navigation. Labels and hierarchy are as production renders them, with one correction
 * approved in STEP-04: `Σχετικά με εμάς`, not production's `Σχετικά με μας`. Greek takes the
 * strong pronoun after a preposition, so the live wording is the loose spoken form. The route
 * `/sxetika-me-mas` is untouched — the slug is a transliteration, not visible copy.
 *
 * Home is reached through the logo, so it has no entry of its own.
 */
export const PRIMARY_NAV: NavItem[] = [
  {
    label: 'Ακουστικά',
    href: ROUTES.hearingAids,
    children: [
      { label: 'Ενδοκαναλικά - CIC', href: ROUTES.hearingAidsCic },
      { label: 'Επαναφορτιζόμενα - Charge&Go', href: ROUTES.hearingAidsRechargeable },
      { label: 'Ανοιχτής Εφαρμογής - RIC', href: ROUTES.hearingAidsRic },
      { label: 'Οπισθωτιαία - BTE', href: ROUTES.hearingAidsBte },
    ],
  },
  {
    label: 'Συνεργάτες',
    href: ROUTES.partners,
    children: [
      { label: 'ΕΟΠΥΥ', href: ROUTES.eopyy },
      { label: 'Πάροχοι Βοηθημάτων Ακοής', href: ROUTES.providers },
    ],
  },
  { label: 'Σχετικά με εμάς', href: ROUTES.about },
  { label: 'Συχνές Ερωτήσεις', href: ROUTES.faq },
  { label: 'Επικοινωνία', href: ROUTES.contact },
];

/**
 * Footer navigation. The legacy footer held only a copyright line; STEP-04 builds the fuller
 * footer the information-architecture specification asks for.
 *
 * Two groups, not three. The footer's third column is the business's address, telephone and
 * opening hours, and that is not navigation — it renders straight from `BUSINESS`, so there is no
 * group here for it. The partner links fold into `Η εταιρεία` rather than standing alone, which
 * also balances the two columns at five links and six.
 *
 * STEP-08 adds the privacy page to `Η εταιρεία` once that page exists; linking it earlier would
 * only produce a 404.
 */
export const FOOTER_NAV: { heading: string; links: NavLink[] }[] = [
  {
    heading: 'Ακουστικά',
    links: [
      { label: 'Όλοι οι τύποι', href: ROUTES.hearingAids },
      { label: 'Ενδοκαναλικά - CIC', href: ROUTES.hearingAidsCic },
      { label: 'Επαναφορτιζόμενα - Charge&Go', href: ROUTES.hearingAidsRechargeable },
      { label: 'Ανοιχτής Εφαρμογής - RIC', href: ROUTES.hearingAidsRic },
      { label: 'Οπισθωτιαία - BTE', href: ROUTES.hearingAidsBte },
    ],
  },
  {
    heading: 'Η εταιρεία',
    links: [
      { label: 'Συνεργάτες', href: ROUTES.partners },
      { label: 'ΕΟΠΥΥ', href: ROUTES.eopyy },
      { label: 'Πάροχοι Βοηθημάτων Ακοής', href: ROUTES.providers },
      { label: 'Σχετικά με εμάς', href: ROUTES.about },
      { label: 'Συχνές Ερωτήσεις', href: ROUTES.faq },
      { label: 'Επικοινωνία', href: ROUTES.contact },
    ],
  },
];
