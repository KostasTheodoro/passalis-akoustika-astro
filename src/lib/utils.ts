import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui's class helper: `clsx` for the conditional logic, `tailwind-merge` for the conflicts.
 *
 * The second half is the part that earns its place. Without it, a component that sets `px-4` and a
 * caller that passes `px-6` both end up in the class list, and which one wins is decided by their
 * order in the stylesheet rather than by the caller. `twMerge` knows the two are the same property
 * and keeps the last.
 *
 * The `.astro` components on this site do not need it. They use Astro's own `class:list`, which
 * handles the conditional half, and none of them takes overriding utilities from a caller. This is
 * for the React island only, which is why it arrived with it in STEP-08 rather than earlier.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
