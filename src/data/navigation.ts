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
 * Primary navigation. Labels and hierarchy are exactly as production renders them, including
 * `Σχετικά με μας` rather than the specification's `Σχετικά με εμάς` — final labels are
 * approved in STEP-04. Home is reached through the logo, so it has no entry of its own.
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
  { label: 'Σχετικά με μας', href: ROUTES.about },
  { label: 'Συχνές Ερωτήσεις', href: ROUTES.faq },
  { label: 'Επικοινωνία', href: ROUTES.contact },
];

/**
 * Footer navigation. The legacy footer held only a copyright line; STEP-04 builds the fuller
 * footer the information-architecture specification asks for, using these groups.
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
    heading: 'Συνεργάτες',
    links: [
      { label: 'ΕΟΠΥΥ', href: ROUTES.eopyy },
      { label: 'Πάροχοι Βοηθημάτων Ακοής', href: ROUTES.providers },
    ],
  },
  {
    heading: 'Η εταιρεία',
    links: [
      { label: 'Σχετικά με μας', href: ROUTES.about },
      { label: 'Συχνές Ερωτήσεις', href: ROUTES.faq },
      { label: 'Επικοινωνία', href: ROUTES.contact },
    ],
  },
];
