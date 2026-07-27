import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

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
 *
 * ---
 *
 * **Why this is `extendTailwindMerge` and not the plain `twMerge`.**
 *
 * `tailwind-merge` resolves conflicts from a built-in map of Tailwind's *default* utilities. This
 * project's type scale is not default: `--text-body-lg` and friends are custom theme tokens, so
 * `text-body-lg` is a class the library has never heard of. Its fallback for an unrecognised
 * `text-*` is to treat it as a **colour**, and that is exactly wrong here.
 *
 * The consequence was a real accessibility failure, found by Lighthouse rather than by reading the
 * code. The submit button asks for `text-white` and then `text-body-lg`; `twMerge` read the second
 * as another colour, decided the two conflicted, and dropped `text-white`. The label fell back to
 * inherited ink on the teal fill and measured **2.07:1** against the 4.5:1 it needs.
 *
 * Registering the scale below tells the library these are font sizes. Colours need no such
 * treatment: an unrecognised `text-*` being assumed to be a colour is right for `text-ink-muted`
 * and wrong only for the sizes, which is why only the sizes are listed.
 *
 * `tests/unit/tokens.test.ts` covers this directly, because the failure mode is silent: nothing
 * errors, a class simply goes missing.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'title', 'section', 'card', 'body-lg', 'body', 'small', 'label'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
