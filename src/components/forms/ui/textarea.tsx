import type * as React from 'react';
import { cn } from '@/lib/utils';

/** shadcn/ui's Textarea, remapped onto this project's tokens. See `input.tsx` for the reasoning. */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-32 w-full rounded-control border border-border-strong bg-surface px-3 py-2',
        'text-body text-ink shadow-sm outline-none transition-colors duration-(--duration-fast)',
        'placeholder:text-ink-muted',
        'hover:border-brand',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-error aria-invalid:border-2',
        // Vertical only. Free resizing lets the box be dragged wider than the card that holds it.
        'resize-y',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
