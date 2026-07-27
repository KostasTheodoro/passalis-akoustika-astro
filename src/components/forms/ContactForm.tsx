import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { type ButtonPhase, PHASE_HOLD_MS, SubmitButton } from '@/components/forms/SubmitButton';
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
import { showToast, Toaster } from '@/components/forms/ui/sonner';
import { Textarea } from '@/components/forms/ui/textarea';
import { CONTACT, ENQUIRY_TYPES, FIELD_LIMITS } from '@/data/contact';
import type { ContactResponse } from '@/lib/forms/contact-response';
import {
  type ContactFieldName,
  type ContactInput,
  type ContactPayload,
  contactSchema,
} from '@/lib/forms/contact-schema';
import { cn } from '@/lib/utils';

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
/**
 * The last outcome, kept only so the inline status line has something to say.
 *
 * DEC-016 and `forms-and-email.md` both require the form's own status to carry the result, because
 * a toast is transient, appears away from the control somebody was using, and may be gone before a
 * screen reader reaches it. The toast is the flourish; this is the record.
 */
type Outcome =
  | { kind: 'sent' }
  | { kind: 'skipped' }
  | { kind: 'rate-limited' }
  | { kind: 'error' };

const STATUS_TONE: Record<'success' | 'error' | 'info', string> = {
  success: 'text-success',
  error: 'text-error',
  info: 'text-warning',
};

/**
 * The tick or the cross beside the status line.
 *
 * The same two glyphs the button and the toast use, so one submission produces one shape rather
 * than three different ways of saying the same thing. `accessibility.md` also asks that state is
 * never signalled by colour alone, and this is what carries that for the status line.
 */
function StatusIcon({ tone }: { tone: 'success' | 'error' | 'info' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tone === 'success' ? <path d="M20 6 9 17l-5-5" /> : <path d="M18 6 6 18M6 6l12 12" />}
    </svg>
  );
}

/** What the inline line says, and how it reads, for each outcome. */
const STATUS_LINE: Record<Outcome['kind'], { text: string; tone: 'success' | 'error' | 'info' }> = {
  sent: { text: `${CONTACT.status.successTitle} ${CONTACT.status.successBody}`, tone: 'success' },
  skipped: {
    text: `${CONTACT.status.developmentTitle} ${CONTACT.status.developmentBody}`,
    tone: 'info',
  },
  'rate-limited': {
    text: `${CONTACT.status.rateLimitedTitle} ${CONTACT.status.rateLimitedBody}`,
    tone: 'error',
  },
  error: { text: `${CONTACT.status.errorTitle} ${CONTACT.status.errorBody}`, tone: 'error' },
};

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
  const [phase, setPhase] = useState<ButtonPhase>('idle');

  const statusId = useId();
  const honeypotId = useId();
  const privacyId = useId();

  /**
   * Holds the button on its result colour, then releases it and raises the toast.
   *
   * The toast fires *after* the button returns to idle rather than at the same moment, so the two
   * are read in sequence instead of competing. Cleared on unmount, because a timer that fires into
   * an unmounted component sets state on nothing.
   */
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  function settle(next: ButtonPhase, then: () => void) {
    setPhase(next);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      setPhase('idle');
      then();
    }, PHASE_HOLD_MS);
  }

  const form = useForm<ContactInput, unknown, ContactPayload>({
    resolver: zodResolver(contactSchema),
    defaultValues: { ...EMPTY_FORM, renderedAt },
    /**
     * `onTouched`: a field is checked when it is first left, and on every keystroke after that.
     *
     * This was `onBlur`, which validated on leaving but never again until the next blur, so a field
     * marked red stayed red while somebody was busy fixing it and only cleared once they moved on.
     * Correcting a mistake should be acknowledged as it happens.
     *
     * It still does not mark a field wrong mid-word on the first pass: nothing is validated until
     * you have finished with it once.
     */
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  /**
   * **Nothing here ever unmounts the form.**
   *
   * An earlier version replaced it with a panel once a submission finished, which meant a failure
   * took the visitor's typing with it and left them pressing a button to get the form back. It also
   * made the development no-send path, which is neither a success nor a failure, read as an error
   * that had eaten the page. Now the button reports and the fields stay exactly where they were.
   */
  async function onSubmit(values: ContactPayload) {
    setOutcome(null);
    setPhase('submitting');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const body = (await response.json()) as ContactResponse;

      if (body.ok && body.delivery === 'sent') {
        setOutcome({ kind: 'sent' });
        settle('success', () => {
          // Cleared only on a real send. A message that went nowhere must not vanish from the box.
          form.reset({ ...EMPTY_FORM, renderedAt: Date.now() });
          showToast('success', CONTACT.status.successTitle, CONTACT.status.successBody);
        });
        return;
      }

      if (body.ok) {
        // Accepted, built, and deliberately not sent, because no Resend key is configured. Amber
        // rather than green: a tick for a message that went nowhere is how a broken contact form
        // reaches production unnoticed.
        setOutcome({ kind: 'skipped' });
        settle('error', () => {
          showToast('info', CONTACT.status.developmentTitle, CONTACT.status.developmentBody);
        });
        return;
      }

      if (body.reason === 'validation') {
        // The server found something the client did not. Its answer is authoritative, so its
        // messages replace whatever the client thought, and focus moves to the first field.
        for (const [field, message] of Object.entries(body.errors)) {
          form.setError(field as ContactFieldName, { type: 'server', message });
        }
        form.setFocus(Object.keys(body.errors)[0] as ContactFieldName);
        settle('error', () => showToast('error', CONTACT.status.invalid));
        return;
      }

      if (body.reason === 'rate-limited') {
        setOutcome({ kind: 'rate-limited' });
        settle('error', () =>
          showToast('error', CONTACT.status.rateLimitedTitle, CONTACT.status.rateLimitedBody),
        );
        return;
      }

      setOutcome({ kind: 'error' });
      settle('error', () =>
        showToast('error', CONTACT.status.errorTitle, CONTACT.status.errorBody),
      );
    } catch {
      // A dropped connection or a non-JSON response. Nothing is logged: the only things to hand are
      // the visitor's own details.
      setOutcome({ kind: 'error' });
      settle('error', () =>
        showToast('error', CONTACT.status.errorTitle, CONTACT.status.errorBody),
      );
    }
  }

  /** Raised when client validation blocks the submit, so the failure is not silent. */
  function onInvalid() {
    showToast('error', CONTACT.status.invalid);
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
            The live region, and the reason the toast is allowed to be a flourish.

            DEC-016 and `forms-and-email.md` both require the form's own status to carry the result.
            A toast is transient, appears away from the control somebody was using, and may be gone
            before a screen reader reaches it. This line is not: it stays until the next submission.

            `polite` rather than `assertive`, so a screen reader finishes the sentence it is on
            before announcing. It is always in the DOM and only its text changes: a region added at
            the same moment as its content is often not announced at all.
          */}
          <div className="flex justify-end">
            <SubmitButton
              phase={phase}
              idleLabel={CONTACT.form.submit}
              pendingLabel={CONTACT.form.submitting}
              successLabel={CONTACT.status.successTitle}
              errorLabel={CONTACT.status.errorTitle}
            />
          </div>

          {/*
            The result, on its own line under the button.

            It used to sit *beside* the button, which squashed the button into an odd shape whenever
            the message was long. A full-width line below it has room for a sentence and does not
            deform anything.

            This is also what satisfies DEC-016. The toast may never be the only notification: it is
            transient, appears away from the control somebody was using, and may be gone before a
            screen reader reaches it. This line stays until the next submission.

            `polite`, so a screen reader finishes its current sentence first, and always in the DOM
            with only its text changing: a region added at the same moment as its content is often
            not announced at all.
          */}
          <p
            id={statusId}
            role="status"
            aria-live="polite"
            className={cn(
              'flex min-h-6 items-start gap-2 text-small font-bold',
              outcome ? STATUS_TONE[STATUS_LINE[outcome.kind].tone] : 'text-ink-muted',
            )}
          >
            {phase === 'submitting' ? CONTACT.form.submitting : null}

            {phase !== 'submitting' && outcome ? (
              <>
                <StatusIcon tone={STATUS_LINE[outcome.kind].tone} />
                <span>{STATUS_LINE[outcome.kind].text}</span>
              </>
            ) : null}
          </p>
        </form>
      </Form>

      <Toaster />
    </>
  );
}
