import type * as React from 'react';
import { FIELD_STATES } from '@/components/forms/ui/input';
import { cn } from '@/lib/utils';

/** shadcn/ui's Textarea, remapped onto this project's tokens. See `input.tsx` for the reasoning. */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-32 w-full rounded-control px-3 py-2 text-body',
        FIELD_STATES,
        // Vertical only. Free resizing lets the box be dragged wider than the card that holds it.
        'resize-y',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
