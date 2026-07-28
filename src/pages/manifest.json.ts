import type { APIRoute } from 'astro';
import { BUSINESS } from '@/data/business';
import { ROUTES } from '@/data/routes';
import { BACKGROUND_COLOR, THEME_COLOR } from '@/data/theme';

/**
 * `/manifest.json`.
 *
 * The live site ships `"name": "MyWebSite"` and `"short_name": "MySite"` — untouched starter
 * template text, on a real business's website, recorded as a confirmed defect in
 * `asset-migration-inventory.md`. This one says who the shop is, from the same `BUSINESS` object
 * everything else reads.
 *
 * **`display: "browser"`, deliberately.** `specifications/seo.md` says not to imply installable
 * capability beyond what is implemented, and this is a static brochure site with no service worker
 * and nothing to do offline. `standalone` — which is what the live site claims — would offer an
 * install prompt for a window that then behaves worse than a tab.
 *
 * **Icons are `purpose: "any"`, also deliberately.** The live site declares both of its icons
 * `maskable` and provides no `any` icon at all, which is the wrong way round: a maskable icon is
 * cropped to a safe circle by the platform, and these carry no safe-zone padding, so the ear would
 * lose its top and bottom. Declared `any`, they are drawn whole.
 *
 * Served as `.json` rather than `.webmanifest` so the correct content type comes from the file
 * extension, which keeps deployment configuration out of this step. Browsers honour it either way.
 */
export const prerender = true;

export const GET: APIRoute = () => {
  const manifest = {
    id: ROUTES.home,
    name: BUSINESS.name,
    /**
     * A home-screen label is truncated somewhere around twelve characters, and
     * `Πασσαλής Ακουστικά` is eighteen. The surname alone is what the shop is known by and is what
     * fits; the full name is still in `name`, which is what an install prompt shows.
     */
    short_name: 'Πασσαλής',
    description: `Ακουστικά βαρηκοΐας, έλεγχος ακοής και υποστήριξη στο ${BUSINESS.address.locality}.`,
    lang: BUSINESS.language,
    dir: 'ltr',
    start_url: ROUTES.home,
    scope: ROUTES.home,
    display: 'browser',
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };

  return new Response(`${JSON.stringify(manifest, null, 2)}\n`, {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
