import type * as React from 'react';
import { FIELD_STATES } from '@/components/forms/ui/input';
import { cn } from '@/lib/utils';

/**
 * The enquiry-type control: a real `<select>`, styled to sit in the shadcn field set.
 *
 * **Maintainer decision during plan review**, and the reasoning is worth keeping. shadcn's Select
 * is `@radix-ui/react-select`, the heaviest single dependency the island could take at roughly
 * 20 kB gzip, and what it buys is a custom listbox. Against that, a native `<select>`:
 *
 * - opens the operating system's own picker on a phone, which is a better control than any
 *   listbox, and one every visitor already knows;
 * - is reachable, typeahead-searchable and announced correctly with no ARIA of our own;
 * - cannot be scrolled out of the viewport or clipped by an ancestor, which is the failure mode
 *   custom listboxes keep rediscovering.
 *
 * The chevron is Lucide's `chevron-down` inlined, matching the icons `astro-icon` renders
 * elsewhere. It is `pointer-events-none` so clicking it still opens the menu.
 *
 * `text-ink-muted` while the value is empty is what makes the placeholder option read as a
 * placeholder; `:valid` flips it once a real choice is made. The option itself is `disabled` so it
 * cannot be chosen back, and `required` on the control is what makes the empty value invalid.
 */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'flex h-11 w-full appearance-none rounded-control py-1 pl-3 pr-10 text-body',
          FIELD_STATES,
          // The placeholder option carries an empty value, so an untouched control is invalid and
          // reads as muted. Once something real is chosen it turns into ordinary body text.
          'invalid:text-ink-muted',
          className,
        )}
        {...props}
      >
        {children}
      </select>

      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

export { Select };
