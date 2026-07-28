import { BUSINESS } from '@/data/business';
import { ROUTES } from '@/data/routes';
import { type BreadcrumbItem, breadcrumbTrail } from '@/lib/navigation/breadcrumbs';
import { toPlainText } from '@/lib/seo/markdown';
import { absoluteUrl } from '@/lib/seo/urls';

/**
 * Every JSON-LD block the site emits, built from `BUSINESS` and the same data the pages render.
 *
 * Two rules run through all of it, both from `specifications/seo.md`:
 *
 * 1. **Nothing unverified.** No ratings, no prices, no services the shop has not confirmed, no
 *    `sameAs` (there are no social profiles), and no `legalName` while `legalEntityName` is still a
 *    placeholder. An absent field costs nothing; a wrong one is a false claim in machine-readable
 *    form on a hearing-aid business.
 * 2. **Nothing the page does not show.** The FAQ answers come from the same bodies the page
 *    renders, the breadcrumb trail from the same array the component draws, and `areaServed` from
 *    localities the contact page names in prose.
 *
 * The live site's markup is the counter-example on both counts: a `SearchAction` for a search
 * feature that does not exist, and a `BreadcrumbList` on pages that never render a trail.
 */

/** The business node's stable id, so other schemas reference it instead of repeating it. */
const BUSINESS_ID = `${BUSINESS.canonicalUrl}/#business`;

/** The social image, which is also the most representative picture of the shop we publish. */
const SOCIAL_IMAGE = absoluteUrl('/og/default.jpg');

interface PostalAddress {
  '@type': 'PostalAddress';
  streetAddress: string;
  addressLocality: string;
  postalCode: string;
  addressCountry: string;
}

interface GeoCoordinates {
  '@type': 'GeoCoordinates';
  latitude: number;
  longitude: number;
}

interface OpeningHours {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

interface Place {
  '@type': 'Place';
  name: string;
}

export interface HearingAidStoreSchema {
  '@context': 'https://schema.org';
  '@type': 'HearingAidStore';
  '@id': string;
  name: string;
  url: string;
  telephone: string;
  email: string;
  image: string;
  logo: string;
  address: PostalAddress;
  geo: GeoCoordinates;
  openingHoursSpecification: OpeningHours[];
  areaServed: Place[];
}

/**
 * The business itself, on every route.
 *
 * `HearingAidStore` is a `Store` subtype of `LocalBusiness` and is exactly what this shop is. The
 * live site uses `MedicalBusiness`, which the discovery audit already flagged as a stretch.
 */
export function hearingAidStore(): HearingAidStoreSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'HearingAidStore',
    '@id': BUSINESS_ID,
    name: BUSINESS.name,
    url: absoluteUrl(ROUTES.home),
    telephone: BUSINESS.telephone.international,
    email: BUSINESS.email,
    image: SOCIAL_IMAGE,
    logo: SOCIAL_IMAGE,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.address.street,
      addressLocality: BUSINESS.address.locality,
      postalCode: BUSINESS.address.postalCode,
      addressCountry: BUSINESS.address.countryCode,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS.geo.latitude,
      longitude: BUSINESS.geo.longitude,
    },
    openingHoursSpecification: BUSINESS.openingHours.machine.map((block) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [...block.days],
      opens: block.opens,
      closes: block.closes,
    })),
    areaServed: BUSINESS.serviceAreaPlaces.map((name) => ({ '@type': 'Place', name })),
  };
}

export interface WebSiteSchema {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  '@id': string;
  name: string;
  url: string;
  inLanguage: string;
  publisher: { '@id': string };
}

/**
 * The site, on every route.
 *
 * Deliberately **without** `potentialAction`. The live site declares a `SearchAction` pointing at
 * `/?q={search_term_string}`; there has never been a search feature, and removing it is an
 * acceptance criterion for this step.
 */
export function webSite(): WebSiteSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BUSINESS.canonicalUrl}/#website`,
    name: BUSINESS.name,
    url: absoluteUrl(ROUTES.home),
    inLanguage: BUSINESS.language,
    publisher: { '@id': BUSINESS_ID },
  };
}

interface ListItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string;
}

export interface BreadcrumbListSchema {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: ListItem[];
}

export function breadcrumbList(items: BreadcrumbItem[]): BreadcrumbListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbTrail(items).map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.label,
      // The current page is the last crumb and is not a link, on the page or here.
      ...(entry.href ? { item: absoluteUrl(entry.href) } : {}),
    })),
  };
}

export interface FaqEntry {
  question: string;
  /** The raw Markdown body, reduced to the text the page shows. */
  answer: string;
}

interface Question {
  '@type': 'Question';
  name: string;
  acceptedAnswer: { '@type': 'Answer'; text: string };
}

export interface FaqPageSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Question[];
}

export function faqPage(entries: FaqEntry[]): FaqPageSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: toPlainText(entry.answer) },
    })),
  };
}

interface PageDetails {
  name: string;
  description: string;
}

export interface ContentPageSchema<T extends 'AboutPage' | 'ContactPage'> {
  '@context': 'https://schema.org';
  '@type': T;
  name: string;
  description: string;
  url: string;
  inLanguage: string;
  isPartOf: { '@id': string };
  about: { '@id': string };
}

function contentPage<T extends 'AboutPage' | 'ContactPage'>(
  type: T,
  route: string,
  { name, description }: PageDetails,
): ContentPageSchema<T> {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url: absoluteUrl(route),
    inLanguage: BUSINESS.language,
    isPartOf: { '@id': `${BUSINESS.canonicalUrl}/#website` },
    about: { '@id': BUSINESS_ID },
  };
}

/** The legacy's `AboutPage` carries only a URL and a language. This one says what the page is. */
export function aboutPage(details: PageDetails): ContentPageSchema<'AboutPage'> {
  return contentPage('AboutPage', ROUTES.about, details);
}

export function contactPage(details: PageDetails): ContentPageSchema<'ContactPage'> {
  return contentPage('ContactPage', ROUTES.contact, details);
}

/** Anything this module produces. `JsonLd.astro` takes these and nothing else. */
export type Schema =
  | HearingAidStoreSchema
  | WebSiteSchema
  | BreadcrumbListSchema
  | FaqPageSchema
  | ContentPageSchema<'AboutPage'>
  | ContentPageSchema<'ContactPage'>;
