import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
  useFormState,
} from 'react-hook-form';
import { Label } from '@/components/forms/ui/label';
import { cn } from '@/lib/utils';

/**
 * shadcn/ui's Form: the react-hook-form binding, remapped onto this project's tokens.
 *
 * This is the part of shadcn that earns its place on accessibility rather than on looks. Getting a
 * field right by hand means `id`, `htmlFor`, `aria-invalid`, and an `aria-describedby` that points
 * at the hint, the error, or both depending on state. That is four related attributes per control,
 * and the failure mode is silent: the field looks fine and a screen reader simply never announces
 * the error.
 *
 * `useFormField` derives all of them from one `name`, so seven controls cannot drift apart the way
 * four hand-maintained attributes would.
 *
 * `@radix-ui/react-slot` is what lets `FormControl` put those attributes onto whatever child it is
 * given, without cloning elements by hand. It was already installed as a dependency of the
 * checkbox, so it costs nothing further.
 */

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { name: TName };

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);
const FormItemContext = React.createContext<{ id: string }>({} as { id: string });

const Form = FormProvider;

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error('useFormField must be used inside a <FormField>');
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

/**
 * `flex flex-col`, not shadcn's `grid gap-2`, and the difference is visible.
 *
 * These items sit in a two-column grid for the name row, so grid stretches both cells to the height
 * of the taller one. A stretched **grid** container with auto rows distributes the leftover height
 * *into* its rows, which meant that the moment one field showed an error the label, the control and
 * the message in the cell beside it all drifted apart, and the input appeared to slide upward.
 *
 * A flex column packs to the top and leaves the slack at the bottom, so an error message grows
 * downward, pushes the fields under it down, and moves nothing that sits beside or above it. That is
 * the behaviour asked for during STEP-08's review.
 */
function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn('flex flex-col gap-2', className)} {...props} />
    </FormItemContext.Provider>
  );
}

/**
 * `htmlFor` is omitted from the accepted props and supplied here instead. `Label` requires it, but
 * the whole point of this wrapper is that the caller never has to know the generated id, and a
 * caller passing their own would silently break the association `useFormField` just built.
 */
function FormLabel({ className, ...props }: Omit<React.ComponentProps<typeof Label>, 'htmlFor'>) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn('data-[error=true]:text-error', className)}
      {...props}
      htmlFor={formItemId}
    />
  );
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      // The hint is always described; the error joins it only once there is one. Pointing at an
      // empty message element would make a screen reader announce nothing after the label and
      // leave the listener waiting.
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={!!error}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn('text-small text-ink-muted', className)}
      {...props}
    />
  );
}

/**
 * The error under a control.
 *
 * Rendered as an empty element when there is nothing wrong, rather than removed: `aria-describedby`
 * on the control points at this id, and a reference to an element that does not exist is ignored
 * by some screen readers even after the element appears.
 *
 * The icon is not decoration. `accessibility.md` requires state not to be signalled by colour
 * alone, and red text on its own is exactly that.
 */
function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField();
  const body = error?.message ? String(error.message) : props.children;

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn('flex items-start gap-1.5 text-small font-bold text-error', className)}
      {...props}
    >
      {body ? (
        <>
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 size-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span>{body}</span>
        </>
      ) : null}
    </p>
  );
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
