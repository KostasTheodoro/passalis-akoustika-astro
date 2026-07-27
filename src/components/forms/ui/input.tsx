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
 * - **`text-body`, never a smaller size on desktop.** shadcn steps down to `text-sm` at `md`. Below
 *   16px, iOS Safari zooms the page when the field takes focus.
 * - **A teal ring instead of the site's ink outline.** See `FIELD_STATES` below.
 */

/**
 * The resting, hover and focus treatment shared by every field on the contact form.
 *
 * **This is the live site's, restored on maintainer instruction.** Production draws a teal border at
 * rest and a 2px teal ring on focus (`border border-primary … focus:ring-primary focus:ring-2
 * focus:outline-none` in the legacy `ContactForm.tsx`). The first version of this form used a grey
 * resting border and the site-wide 3px ink outline, which is right for the header and the footer but
 * reads as harsh and foreign inside a white form card.
 *
 * **It is the site's only exception to the one-focus-ring rule in `global.css`**, which is why it
 * lives in one constant that all three controls import rather than being copied three times.
 *
 * **The ring is `brand-strong`, not the identity `brand` the live site uses.** Both clear the 3:1
 * that WCAG 1.4.11 asks of a focus indicator, but on white `brand` measures 3.38:1 and
 * `brand-strong` 4.74:1. They read as the same teal, and taking the weaker one purely to match a hex
 * would be copying a shortcoming. `tokens.test.ts` recomputes both.
 */
export const FIELD_STATES = [
  'border border-brand bg-surface text-ink shadow-sm',
  'transition-[color,border-color,box-shadow] duration-(--duration-fast)',
  'placeholder:text-ink-muted',
  'hover:border-brand-strong',
  // `outline-none` is safe here only because the ring immediately replaces it. Nothing on this site
  // removes an outline without putting something at least as strong in its place.
  'outline-none focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:border-brand-strong',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
  // Not colour alone: the control also carries `aria-invalid`, which is what a screen reader
  // announces, and the message beneath it says what is wrong in words.
  'aria-invalid:border-error aria-invalid:border-2 aria-invalid:focus-visible:ring-error',
].join(' ');

function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-control px-3 py-1 text-body',
        FIELD_STATES,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
