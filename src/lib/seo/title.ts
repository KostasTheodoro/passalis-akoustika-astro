import { BUSINESS } from '@/data/business';

/**
 * The one place the brand suffix is applied.
 *
 * Every `seo.title` on the site is written without the brand, deliberately. STEP-02, STEP-06 and
 * STEP-07 each stripped it out and left a comment pointing here, because the live site appends the
 * brand through a template *and* has it typed into some page titles, which is why `/synergates`
 * currently reads `… | Πασσαλής Ακουστικά | Πασσαλής Ακουστικά`.
 *
 * Patching suffixes into thirteen content files would bring that defect straight back, so instead
 * the template lives here and `buildTitle` throws if a base already names the brand.
 */

/** Appended to every page title except the home page's. */
export const TITLE_SUFFIX = `${BUSINESS.name}, ${BUSINESS.address.locality}`;

const SEPARATOR = ' | ';

interface TitleOptions {
  /**
   * `false` renders the base verbatim. Only the home page does this: its title is the site's
   * default and already names the brand, exactly as the legacy `default`/`template` pair worked.
   */
  brand?: boolean;
}

export function buildTitle(base: string, { brand = true }: TitleOptions = {}): string {
  const trimmed = base.trim();

  if (trimmed.length === 0) {
    throw new Error('A page title cannot be empty: the result would be a bare brand suffix.');
  }

  if (!brand) return trimmed;

  if (trimmed.includes(BUSINESS.name)) {
    throw new Error(
      `The title "${trimmed}" already contains "${BUSINESS.name}", so appending the suffix would ` +
        `repeat it — the defect the live site ships on /synergates. Either drop the brand from the ` +
        `title, or pass { brand: false } if this page owns its whole title.`,
    );
  }

  return `${trimmed}${SEPARATOR}${TITLE_SUFFIX}`;
}
