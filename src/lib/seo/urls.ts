import { BUSINESS } from '@/data/business';

/**
 * Absolute URLs for canonicals, Open Graph, the sitemap and structured data.
 *
 * The origin is always `BUSINESS.canonicalUrl`, never `Astro.url`. A preview deployment that
 * canonicalised to itself would be inviting Google to index the preview instead of production, and
 * `PUBLIC_SITE_URL` keeps its one existing job — the contact endpoint's origin check.
 */

/** The production origin, with no trailing slash. */
export const SITE_ORIGIN: string = BUSINESS.canonicalUrl;

export function absoluteUrl(path: string): string {
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;

  // The root keeps its slash, because an origin on its own is not a URL path. Everything else
  // loses it: the site serves no trailing slashes and two spellings of one page are two URLs.
  const normalized = withLeadingSlash === '/' ? '/' : withLeadingSlash.replace(/\/+$/, '') || '/';

  return `${SITE_ORIGIN}${normalized}`;
}
