/**
 * Every icon the site draws, named once.
 *
 * Templates use these keys rather than Iconify strings, so swapping an icon — or moving a whole
 * group to a different set — is an edit here and nowhere else. `astro-icon` resolves the values to
 * inline SVG at build time; nothing about icons reaches the browser as JavaScript.
 *
 * Two sets, deliberately. Lucide is the shell set: one consistent 24px stroke grid. Heroicons is
 * kept only for the four home-page service icons, because that is where the live site draws them
 * from and keeping the set means those four do not change.
 */
export const ICONS = {
  /** Shell and general use — Lucide. */
  phone: 'lucide:phone',
  mail: 'lucide:mail',
  mapPin: 'lucide:map-pin',
  clock: 'lucide:clock',
  menu: 'lucide:menu',
  close: 'lucide:x',
  chevronDown: 'lucide:chevron-down',
  chevronRight: 'lucide:chevron-right',
  external: 'lucide:external-link',

  /**
   * Home-page service cards — Heroicons, matching the live site exactly. The keys are the same
   * four `ServiceCard['icon']` values `src/data/home.ts` already declares.
   */
  'hearing-test': 'heroicons:speaker-wave',
  'custom-fit': 'heroicons:wrench',
  warranty: 'heroicons:check-badge',
  support: 'heroicons:heart',
} as const satisfies Record<string, `${string}:${string}`>;

export type IconName = keyof typeof ICONS;
