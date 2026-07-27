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
 * ## The button carries the result
 *
 * Added during STEP-08's review, on maintainer instruction, and it replaced a panel that used to
 * take the form's place when a submission finished. **The form now never goes away**, so the
 * outcome has to show somewhere the eye is already resting: the control that was just pressed.
 *
 * `success` and `error` are held for `PHASE_HOLD_MS` and then release back to `idle`. The toast is
 * raised *after* that, by the caller, so the two do not change at the same moment and compete.
 *
 * The label disappears in the two result phases on purpose. A green tick beside the words
 * "Αποστολή μηνύματος" reads as an instruction that has been confirmed rather than as an outcome.
 */
export type ButtonPhase = 'idle' | 'submitting' | 'success' | 'error';

/** Long enough to register as a state, short enough not to feel like the form has hung. */
export const PHASE_HOLD_MS = 900;

interface SubmitButtonProps extends Omit<React.ComponentProps<'button'>, 'children'> {
  phase: ButtonPhase;
  idleLabel: string;
  pendingLabel: string;
  /** Announced in the two result phases, where the visible label is replaced by an icon alone. */
  successLabel: string;
  errorLabel: string;
}

function Spinner() {
  return (
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
  );
}

function PhaseIcon({ phase }: { phase: ButtonPhase }) {
  const shared = 'size-6 shrink-0 motion-safe:animate-(--animate-toast-icon)';

  if (phase === 'success') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={shared}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={shared}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * The mail glyph, the same one `Button.astro` renders through `astro-icon` on every other contact
 * call to action on the site.
 */
function MailIcon() {
  return (
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
  );
}

function SubmitButton({
  phase,
  idleLabel,
  pendingLabel,
  successLabel,
  errorLabel,
  className,
  ...props
}: SubmitButtonProps) {
  const result = phase === 'success' || phase === 'error';

  /**
   * The two result phases swap the fill for the status colour.
   *
   * Both are dark enough to carry a white label: `--color-success` measures **5.02:1** against white
   * and `--color-error` **6.54:1**. Contrast is symmetric, so the existing `tokens.test.ts` check
   * that both clear AA as text on a white ground is the same measurement as white text on them.
   */
  const fill = {
    idle: 'border-brand-strong bg-brand-strong text-white hover:bg-surface hover:text-brand-strong',
    submitting: 'border-brand-strong bg-brand-strong text-white',
    success: 'border-success bg-success text-white',
    error: 'border-error bg-error text-white',
  }[phase];

  return (
    <button
      type="submit"
      disabled={phase === 'submitting' || result}
      aria-busy={phase === 'submitting'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-pill border-2 font-bold',
        'transition-[color,background-color,border-color,transform] duration-(--duration-fast) ease-out',
        // No lift while it is showing a result: the button is reporting, not inviting a press.
        !result && 'motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.98]',
        // `disabled:opacity-60` would grey out the green and the red, which are the whole point.
        result ? 'disabled:opacity-100' : 'disabled:pointer-events-none disabled:opacity-60',
        'h-13 px-8 text-body-lg',
        fill,
        className,
      )}
      {...props}
    >
      {phase === 'submitting' && <Spinner />}
      {phase === 'idle' && <MailIcon />}
      {result && <PhaseIcon phase={phase} />}

      {phase === 'idle' && idleLabel}
      {phase === 'submitting' && pendingLabel}

      {/*
        The result phases show an icon and no text, so the button would otherwise lose its accessible
        name at the exact moment it is saying something. This keeps one.
      */}
      {result && <span className="sr-only">{phase === 'success' ? successLabel : errorLabel}</span>}
    </button>
  );
}

export { SubmitButton };
