import { Toaster as Sonner, type ToasterProps, toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * The toast, built as our own markup rather than styled through sonner's classes.
 *
 * The first version passed `toastOptions.classNames` and took sonner's layout. This one uses
 * `toast.custom()` against an **unstyled** `Toaster`, which is the pattern the maintainer's other
 * site uses and asked for here: sonner keeps the queue, the stacking, the swipe-to-dismiss and the
 * timing, and everything visible is ours.
 *
 * **The countdown bar is the point.** A plain toast fades out with no warning; this one shows how
 * long is left, and stops the clock while it is being read. `global.css` holds the keyframes and the
 * pause rule, so the motion lives with the rest of the site's motion rather than in a `<style>` tag.
 *
 * **It is still secondary feedback and never the only signal.** DEC-016 and `forms-and-email.md`
 * both require the form's own inline status to carry the outcome, because a toast is transient,
 * appears away from the control somebody was using, and may be gone before a screen reader reaches
 * it. This is the flourish on top.
 */

/** Shared by the bar's `animation-duration` and by sonner's dismiss timer, so they cannot disagree. */
export const TOAST_DURATION_MS = 6000;

export type ToastVariant = 'success' | 'error' | 'info';

/**
 * Lucide's `check`, `x` and `info`, inlined.
 *
 * The same three glyph sets `astro-icon` renders everywhere else on the site, drawn by hand here
 * because `lucide-react` would be a React icon library added to draw three shapes.
 */
function ToastIcon({ variant }: { variant: ToastVariant }) {
  const paths: Record<ToastVariant, React.ReactNode> = {
    success: <path d="M20 6 9 17l-5-5" />,
    error: <path d="M18 6 6 18M6 6l12 12" />,
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0 motion-safe:animate-(--animate-toast-icon)"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[variant]}
    </svg>
  );
}

const TONE: Record<ToastVariant, { icon: string; bar: string }> = {
  success: { icon: 'text-success', bar: 'bg-success' },
  error: { icon: 'text-error', bar: 'bg-error' },
  // Amber, for the development no-send path: nothing failed and nothing was sent either.
  info: { icon: 'text-warning', bar: 'bg-warning' },
};

function ToastBody({
  variant,
  title,
  description,
}: {
  variant: ToastVariant;
  title: string;
  description?: string;
}) {
  const tone = TONE[variant];

  return (
    <div
      // `role="status"` rather than `alert`: the form's own live region has already announced the
      // outcome by the time this appears, and two assertive announcements talk over each other.
      role="status"
      className={cn(
        'relative w-full overflow-hidden rounded-card border border-border bg-surface shadow-lg',
        'flex items-start gap-3 p-card pb-5',
      )}
    >
      <span className={tone.icon}>
        <ToastIcon variant={variant} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{title}</p>
        {description ? <p className="mt-1 text-small text-ink-muted">{description}</p> : null}
      </div>

      {/*
        The countdown. `origin-left` plus a `scaleX` animation, so it runs on the compositor and
        never triggers layout. Hidden from assistive technology: it is a clock, not information.
      */}
      <span
        data-toast-bar
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 bottom-0 h-1 origin-left',
          'motion-safe:animate-(--animate-toast-bar)',
          tone.bar,
        )}
        style={{ animationDuration: `${TOAST_DURATION_MS}ms` }}
      />
    </div>
  );
}

/** Raises a toast. The only way this module is used from the form. */
export function showToast(variant: ToastVariant, title: string, description?: string) {
  toast.custom(() => <ToastBody variant={variant} title={title} description={description} />, {
    duration: TOAST_DURATION_MS,
  });
}

/**
 * `unstyled` is what hands the markup over to `ToastBody`. Without it sonner wraps the custom
 * content in its own card and there are two borders.
 *
 * **Top right**, on maintainer instruction. Bottom centre would sit over the submit button on a
 * phone, which is exactly where the visitor is looking and exactly what they might press again.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-right"
      duration={TOAST_DURATION_MS}
      // Wider than sonner's default, so a two-line Greek sentence does not wrap to four.
      toastOptions={{ unstyled: true, classNames: { toast: 'w-full' } }}
      style={{ width: 'min(26rem, calc(100vw - 2rem))' }}
      {...props}
    />
  );
}

export { Toaster };
