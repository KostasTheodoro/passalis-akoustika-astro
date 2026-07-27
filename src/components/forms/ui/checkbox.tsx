import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui's Checkbox, on Radix, remapped onto this project's tokens.
 *
 * **This is the only Radix package in the project**, and it is here by maintainer decision during
 * plan review: the animated tick was wanted, and ~4 kB gzip is a reasonable price for the one
 * control a visitor has to deliberately act on before the form will send anything.
 *
 * Two consequences worth knowing, because neither is obvious from the markup:
 *
 * 1. **The browser's own `required` no longer applies.** Radix renders a `<button role="checkbox">`
 *    plus a hidden input, so native constraint validation does not see it. Nothing is lost:
 *    `privacy: z.literal(true)` in the shared schema is what actually enforces consent, and the
 *    server enforces it again. This control now behaves like the other six rather than being the
 *    one field validated by a different mechanism.
 * 2. **The tick is animated by `--animate-check`**, declared in `global.css`. It is an animation
 *    rather than a transition because Radix mounts the indicator only once the box is checked. The
 *    reduced-motion block in the same file zeroes it, and a browser test asserts that rather than
 *    assuming it, since this is the first animated component on the site.
 *
 * The tick itself is an inline SVG rather than `lucide-react`. The path is Lucide's own `check`, so
 * it matches the icons `astro-icon` inlines everywhere else, and it saves adding a React icon
 * library to draw one glyph.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-5 shrink-0 rounded-control border-2 border-brand bg-surface shadow-sm',
        'grid place-content-center transition-[color,border-color,box-shadow] duration-(--duration-fast)',
        'hover:border-brand-strong',
        // The same teal ring the text fields take, for the same reason: this sits inside the form
        // card with them, and one control focusing differently from its neighbours looks broken.
        'outline-none focus-visible:ring-2 focus-visible:ring-brand-strong',
        'data-[state=checked]:border-brand-strong data-[state=checked]:bg-brand-strong',
        'data-[state=checked]:text-white',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-error aria-invalid:focus-visible:ring-error',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="animate-(--animate-check) text-current"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <title>Επιλεγμένο</title>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
