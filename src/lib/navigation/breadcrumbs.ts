import { ROUTES } from '@/data/routes';

/**
 * The breadcrumb trail, in one place, because two things now draw it.
 *
 * `Breadcrumbs.astro` renders it and STEP-09's `BreadcrumbList` describes it. The home crumb used
 * to be prepended inside the component, which would have meant the JSON-LD silently describing a
 * shorter journey than the page shows. Both call `breadcrumbTrail` instead.
 *
 * The type lives here rather than in the component so plain `.ts` modules can import it — ten pages
 * still import it from `Breadcrumbs.astro`, which re-exports it.
 */
export interface BreadcrumbItem {
  label: string;
  /** Absent on the current page, which is always the last item. */
  href?: string;
}

/** Home is implicit on every trail, so callers pass only the part below it. */
export function breadcrumbTrail(items: BreadcrumbItem[]): BreadcrumbItem[] {
  return [{ label: 'Αρχική', href: ROUTES.home }, ...items];
}
