import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { Checkbox } from '@/components/forms/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/forms/ui/form';
import { Input } from '@/components/forms/ui/input';
import { Label } from '@/components/forms/ui/label';
import { Select } from '@/components/forms/ui/select';
import { Toaster } from '@/components/forms/ui/sonner';
import { Textarea } from '@/components/forms/ui/textarea';
import { CONTACT, ENQUIRY_TYPES, FIELD_LIMITS } from '@/data/contact';
import type { ContactResponse } from '@/lib/forms/contact-response';
import {
  type ContactFieldName,
  type ContactInput,
  type ContactPayload,
  contactSchema,
} from '@/lib/forms/contact-schema';

/**
 * The contact form, and the only React island on the site.
 *
 * **Why this is React when nothing else is.** DEC-005 allows React for justified client-side
 * interaction, and this is the one place with real client state: seven controls, a per-field error
 * map, a submitting flag, a result and a toast queue. Everything else on the site is static markup
 * or interaction the platform does better, which is what DEC-027 recorded.
 *
 * **What happens with JavaScript off.** The markup renders, so the form is visible and readable,
 * but submitting does nothing. That is a real limitation and it is not hidden: the telephone, email
 * and address sit next to the form as a working way to reach the business, and the page never
 * suggests the form is the only route. The legacy site had the same limitation and no alternative
 * beside it.
 *
 * The island is hydrated with `client:idle` rather than `client:load` so it waits for a free main
 * thread, and rather than `client:visible` so somebody who starts typing before hydration cannot
 * have their input discarded when React attaches.
 */
type Outcome =
  | { kind: 'success'; delivery: 'sent' | 'skipped' }
  | { kind: 'rate-limited' }
  | { kind: 'error' };

const EMPTY_FORM: ContactInput = {
  firstName: '',
  lastName: '',
  email: '',
  telephone: '',
  enquiryType: '',
  message: '',
  privacy: false,
  website: '',
  renderedAt: 0,
};

export function ContactForm() {
  /**
   * Stamped once, when the island hydrates. The server checks the gap between this and the moment
   * the request arrives, which is one of the cheap signals that separates a person filling in a
   * form from a script posting to the endpoint.
   */
  const [renderedAt] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const statusId = useId();
  const honeypotId = useId();
  const privacyId = useId();

  const form = useForm<ContactInput, unknown, ContactPayload>({
    resolver: zodResolver(contactSchema),
    defaultValues: { ...EMPTY_FORM, renderedAt },
    // Errors appear when a field is left, not on every keystroke, and clear as soon as the value
    // becomes valid. Validating while somebody is still typing their email marks it wrong before
    // they have finished writing it.
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: ContactPayload) {
    setOutcome(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const body = (await response.json()) as ContactResponse;

      if (body.ok) {
        setOutcome({ kind: 'success', delivery: body.delivery });
        form.reset({ ...EMPTY_FORM, renderedAt: Date.now() });

        // Secondary only. The panel that replaces the form is the real confirmation; this is a
        // flourish on top of it, and DEC-016 is explicit that it must never be the sole signal.
        if (body.delivery === 'sent') {
          toast.success(CONTACT.status.successTitle, { description: CONTACT.status.successBody });
        } else {
          toast.warning(CONTACT.status.developmentTitle, {
            description: CONTACT.status.developmentBody,
          });
        }
        return;
      }

      if (body.reason === 'validation') {
        // The server found something the client did not. Its answer is authoritative, so its
        // messages replace whatever the client thought, and focus moves to the first field.
        for (const [field, message] of Object.entries(body.errors)) {
          form.setError(field as ContactFieldName, { type: 'server', message });
        }
        form.setFocus(Object.keys(body.errors)[0] as ContactFieldName);
        toast.error(CONTACT.status.invalid);
        return;
      }

      if (body.reason === 'rate-limited') {
        setOutcome({ kind: 'rate-limited' });
        toast.error(CONTACT.status.rateLimitedTitle, {
          description: CONTACT.status.rateLimitedBody,
        });
        return;
      }

      setOutcome({ kind: 'error' });
      toast.error(CONTACT.status.errorTitle, { description: CONTACT.status.errorBody });
    } catch {
      // A dropped connection or a non-JSON response. Nothing is logged: the only things to hand are
      // the visitor's own details.
      setOutcome({ kind: 'error' });
      toast.error(CONTACT.status.errorTitle, { description: CONTACT.status.errorBody });
    }
  }

  /** Announced when the browser's own validation blocks the submit, so the failure is not silent. */
  function onInvalid() {
    toast.error(CONTACT.status.invalid);
  }

  if (outcome?.kind === 'success') {
    return (
      <>
        <SuccessPanel delivery={outcome.delivery} onReset={() => setOutcome(null)} />
        <Toaster />
      </>
    );
  }

  const required = <span className="text-error"> *</span>;

  return (
    <>
      <Form {...form}>
        <form
          noValidate
          aria-label={CONTACT.form.label}
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="flex flex-col gap-5"
        >
          <p className="text-small text-ink-muted">{CONTACT.form.requiredNote}</p>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {CONTACT.form.fields.firstName.label}
                    {required}
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="given-name"
                      maxLength={FIELD_LIMITS.name}
                      placeholder={CONTACT.form.fields.firstName.placeholder}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {CONTACT.form.fields.lastName.label}
                    {required}
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="family-name"
                      maxLength={FIELD_LIMITS.name}
                      placeholder={CONTACT.form.fields.lastName.placeholder}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email
                  {required}
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={FIELD_LIMITS.email}
                    placeholder={CONTACT.form.fields.email.placeholder}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="telephone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {CONTACT.form.fields.telephone.label}
                  <span className="font-normal text-ink-muted italic">
                    {' '}
                    {CONTACT.form.optional}
                  </span>
                </FormLabel>
                <FormControl>
                  {/*
                    `type="tel"` without the legacy form's `inputMode="numeric"`: a Greek number is
                    often written with a leading `+30`, and the numeric keypad has no `+`.
                  */}
                  <Input
                    type="tel"
                    autoComplete="tel"
                    maxLength={FIELD_LIMITS.telephone}
                    placeholder={CONTACT.form.fields.telephone.placeholder}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enquiryType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {CONTACT.form.fields.enquiryType.label}
                  {required}
                </FormLabel>
                <FormControl>
                  <Select {...field}>
                    <option value="" disabled>
                      {CONTACT.form.fields.enquiryType.placeholder}
                    </option>
                    {ENQUIRY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {CONTACT.form.fields.message.label}
                  {required}
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={6}
                    maxLength={FIELD_LIMITS.messageMax}
                    placeholder={CONTACT.form.fields.message.placeholder}
                    {...field}
                  />
                </FormControl>
                {/*
                  The health-data warning sits here rather than only in the privacy notice, because
                  this is where somebody is about to type it. A hearing-aid shop's contact form is
                  an obvious place to describe a medical condition, and that is a GDPR Article 9
                  special category with a much higher bar than a name and an email.
                */}
                <FormDescription>{CONTACT.form.messageHint}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="privacy"
            render={({ field, fieldState }) => (
              <FormItem className="gap-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={privacyId}
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    aria-invalid={!!fieldState.error}
                    aria-describedby={fieldState.error ? `${privacyId}-error` : undefined}
                    className="mt-0.5"
                  />

                  {/*
                    The link sits inside the label. `accessibility.md` asks for exactly that, and
                    it is why this field is built by hand rather than through `FormControl`: a
                    label wrapping a link and a Radix checkbox is not the single-control shape that
                    component assumes.
                  */}
                  <Label htmlFor={privacyId} className="items-start text-body font-normal">
                    <span>
                      {CONTACT.form.privacy.before}
                      <a
                        href={CONTACT.form.privacy.linkHref}
                        className="rounded-control font-bold text-brand-deep underline underline-offset-2 hover:text-ink"
                      >
                        {CONTACT.form.privacy.linkLabel}
                      </a>
                      {CONTACT.form.privacy.after}
                      {required}
                    </span>
                  </Label>
                </div>

                {fieldState.error ? (
                  <p
                    id={`${privacyId}-error`}
                    className="flex items-start gap-1.5 text-small font-bold text-error"
                  >
                    <span>{fieldState.error.message}</span>
                  </p>
                ) : null}
              </FormItem>
            )}
          />

          {/*
            The honeypot.

            Not `display: none`, which the better bots check for. It is pulled out of the layout and
            off screen, hidden from the accessibility tree, skipped by the tab order and excluded
            from autofill, so no person and no screen reader will ever meet it, while a script that
            fills every input it finds will.

            It carries an ordinary-looking name and label for the same reason: an unlabelled field
            called `honeypot` is easier to avoid than a plausible one called `website`.
          */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <Label htmlFor={honeypotId}>{CONTACT.form.honeypotLabel}</Label>
            <input
              id={honeypotId}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...form.register('website')}
            />
          </div>

          {/*
            The live region.

            `polite` rather than `assertive`, and outside the form's own flow, so a screen reader
            finishes the sentence it is on before announcing the result. It is always in the DOM
            and only its text changes: a region added at the same moment as its content is often
            not announced at all.
          */}
          <p
            id={statusId}
            role="status"
            aria-live="polite"
            className="text-small font-bold text-ink-muted"
          >
            {isSubmitting ? CONTACT.form.submitting : null}
          </p>

          {outcome?.kind === 'rate-limited' ? (
            <StatusPanel
              tone="error"
              title={CONTACT.status.rateLimitedTitle}
              body={CONTACT.status.rateLimitedBody}
            />
          ) : null}

          {outcome?.kind === 'error' ? (
            <StatusPanel
              tone="error"
              title={CONTACT.status.errorTitle}
              body={CONTACT.status.errorBody}
            />
          ) : null}

          <div className="flex justify-end">
            <SubmitButton pending={isSubmitting} pendingLabel={CONTACT.form.submitting}>
              {CONTACT.form.submit}
            </SubmitButton>
          </div>
        </form>
      </Form>

      <Toaster />
    </>
  );
}

/** Shared shell for the failure notices, so the two cannot drift apart visually. */
function StatusPanel({
  tone,
  title,
  body,
}: {
  tone: 'success' | 'error';
  title: string;
  body: string;
}) {
  const success = tone === 'success';

  return (
    <div
      className={
        success
          ? 'rounded-card border-2 border-success bg-brand-50 p-card'
          : 'rounded-card border-2 border-error bg-page p-card'
      }
    >
      <p className={success ? 'font-bold text-success' : 'font-bold text-error'}>{title}</p>
      <p className="mt-1 text-body text-ink-muted">{body}</p>
    </div>
  );
}

/**
 * Replaces the form once a message is accepted.
 *
 * `tabIndex={-1}` plus the `status` role is what makes this reachable and announced: the form that
 * held focus has just been unmounted, so without somewhere to send it, focus falls back to the
 * document and a keyboard user is returned silently to the top of the page.
 */
function SuccessPanel({
  delivery,
  onReset,
}: {
  delivery: 'sent' | 'skipped';
  onReset: () => void;
}) {
  const sent = delivery === 'sent';

  return (
    <div role="status" aria-live="polite" tabIndex={-1} className="flex flex-col gap-4">
      <StatusPanel
        tone={sent ? 'success' : 'error'}
        title={sent ? CONTACT.status.successTitle : CONTACT.status.developmentTitle}
        body={sent ? CONTACT.status.successBody : CONTACT.status.developmentBody}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-pill border-2 border-transparent px-6 font-bold text-brand-strong transition-colors duration-(--duration-fast) hover:text-brand-deep hover:underline"
        >
          Νέο μήνυμα
        </button>
      </div>
    </div>
  );
}
