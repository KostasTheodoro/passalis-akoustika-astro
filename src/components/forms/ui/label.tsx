import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui's Label styling on a plain `<label>`.
 *
 * shadcn's version wraps `@radix-ui/react-label`, and that package is not installed here. It exists
 * to fix one thing: in some older browsers, clicking a label's text selected it instead of
 * focusing the control. Every browser this site supports handles `htmlFor` correctly, and the
 * wrapper supplies no other behaviour, so it would be a dependency bought for nothing. The styling
 * is what has value, and the styling is not the Radix part.
 *
 * `font-bold`, not shadcn's `font-medium`: Sansation ships 400 and 700 only. A 500 would be
 * synthesised by the browser, which is exactly what `global.css`'s type scale exists to avoid.
 */
/**
 * `htmlFor` is required rather than optional, which is stricter than both shadcn and the DOM.
 *
 * A label with no control is the single most common accessibility defect in a form: it looks
 * correct, it reads correctly, and clicking it does nothing while a screen reader announces the
 * field as unlabelled. Making the association part of the type means it cannot be forgotten.
 */
interface LabelProps extends React.ComponentProps<'label'> {
  htmlFor: string;
}

function Label({ className, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: LabelProps requires htmlFor, so every use is associated with a control; the rule cannot see that through the props spread.
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-1.5 text-small font-bold text-ink select-none',
        'has-disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
