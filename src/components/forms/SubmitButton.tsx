import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The form's submit button: a React port of `src/components/ui/Button.astro`.
 *
 * shadcn's own Button was deliberately not vendored. Ours already carries the decision that the
 * fill is `brand-strong` rather than the identity teal, because white on `--color-brand` measures
 * 3.38:1 and a button label needs 4.5:1, and it keeps the hover inversion the live site has and the
 * client is used to. Taking shadcn's would have meant editing all of that back in, and the site
 * would have had two button designs.
 *
 * The classes below are `Button.astro`'s `primary` variant at `lg`, copied rather than shared
 * because one is a React component and the other is an Astro component; `tests/e2e/contact.spec.ts`
 * compares the two rendered class lists so they cannot drift apart silently.
 *
 * While sending, the button is disabled and its label changes. It is never *removed* and the form
 * is never replaced mid-flight, so a failure leaves the visitor exactly where they were with
 * everything they typed still in place.
 */
interface SubmitButtonProps extends React.ComponentProps<'button'> {
  pending: boolean;
  pendingLabel: string;
}

function SubmitButton({ pending, pendingLabel, children, className, ...props }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      // Tells assistive technology the control is working, without stealing focus from it.
      aria-busy={pending}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-pill font-bold',
        'transition-[color,background-color,border-color,transform] duration-(--duration-fast) ease-out',
        'motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-60',
        'border-2 border-brand-strong bg-brand-strong text-white hover:bg-surface hover:text-brand-strong',
        'h-13 px-8 text-body-lg',
        className,
      )}
      {...props}
    >
      {pending ? (
        <svg
          viewBox="0 0 24 24"
          className="size-5 shrink-0 animate-spin"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        // Lucide's `mail`, the same glyph `Button.astro` renders through `astro-icon` on every
        // other contact call to action on the site.
        <svg
          viewBox="0 0 24 24"
          className="size-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
          <rect width="20" height="16" x="2" y="4" rx="2" />
        </svg>
      )}

      {pending ? pendingLabel : children}
    </button>
  );
}

export { SubmitButton };
