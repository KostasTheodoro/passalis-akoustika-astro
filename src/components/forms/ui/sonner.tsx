import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * shadcn/ui's Sonner wrapper, minus `next-themes`.
 *
 * shadcn's version reads the active theme from `next-themes` to pick a light or dark toast. This
 * site has one theme, so that dependency would be installed to answer a question with a constant.
 *
 * **The toast is secondary feedback and never the only signal.** DEC-016 and
 * `forms-and-email.md` both say so, and it matters more than it sounds: a toast is transient,
 * appears away from the control the visitor was using, and a screen reader may or may not reach it
 * before it disappears. The form's own inline status panel is the real answer; this is a flourish
 * on top of it.
 *
 * `richColors` is deliberately off. It would paint success green and error red from Sonner's own
 * palette, which is a second colour system, and neither has been checked for contrast on this
 * site's grounds. The toast is styled from our tokens instead.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      // Bottom centre on a phone puts the toast over the submit button, which is exactly where the
      // visitor is looking and exactly what they might tap again.
      position="top-center"
      // Long enough to read a Greek sentence without hurrying, short enough not to sit in the way.
      duration={6000}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'rounded-card border border-border bg-surface text-ink shadow-lg text-body font-sans',
          title: 'font-bold text-ink',
          description: 'text-small text-ink-muted',
          actionButton: 'rounded-pill bg-brand-strong text-white',
          closeButton: 'rounded-control border-border text-ink-muted',
          success: 'border-success',
          error: 'border-error',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
