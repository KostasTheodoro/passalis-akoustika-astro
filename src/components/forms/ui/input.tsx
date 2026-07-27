import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui's Input, with its class list rewritten onto this project's tokens.
 *
 * The structure and the API are shadcn's; the values are ours. `shadcn init` would have written a
 * second colour system into `global.css` (`--background`, `--input`, `--ring`, `--destructive`),
 * and this site's whole design premise is one documented palette whose contrast ratios
 * `tokens.test.ts` recomputes. So the primitives were vendored by hand and remapped instead.
 *
 * Three deliberate departures from shadcn's defaults:
 *
 * - **`h-11`, not `h-9`.** `responsive-behavior.md` asks for a 44px touch target, which is what
 *   `Button.astro`'s `md` size already is.
 * - **No focus ring of its own.** shadcn draws `focus-visible:ring-[3px]`; `global.css` already
 *   draws one 3px outline for every focusable element on the site. A second would either double up
 *   or quietly win, and the site would have two focus treatments.
 * - **`text-body`, never a smaller size on desktop.** shadcn steps down to `text-sm` at `md`. Below
 *   16px, iOS Safari zooms the page when the field takes focus.
 */
function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-control border border-border-strong bg-surface px-3 py-1',
        'text-body text-ink shadow-sm outline-none transition-colors duration-(--duration-fast)',
        'placeholder:text-ink-muted',
        'hover:border-brand',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
        // Not colour alone: the control also carries `aria-invalid`, which is what a screen reader
        // announces, and the message beneath it says what is wrong in words.
        'aria-invalid:border-error aria-invalid:border-2',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
