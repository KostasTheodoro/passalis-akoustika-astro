import { z } from 'zod';
import {
  CONTACT_ERRORS,
  ENQUIRY_TYPE_VALUES,
  type EnquiryTypeValue,
  FIELD_LIMITS,
  TELEPHONE_PATTERN,
} from '@/data/contact';

/**
 * The contact form's contract, written once and imported by both ends.
 *
 * This file is the structural fix for the legacy site's worst defect. There, `ContactForm.tsx`
 * marked first name, last name, email and message required, while `api/route.ts` checked only
 * first name, email and message. The two were written separately and drifted, so the server
 * accepted a submission the form itself would not have sent.
 *
 * Here the island and the endpoint import the same object. They cannot disagree, because there is
 * nothing to disagree about.
 *
 * **The server is still the authority.** The client runs this to be helpful, so a visitor sees a
 * mistake before they submit rather than after a round trip. Nothing the client reports is trusted;
 * the endpoint parses the payload again and its answer is the one that counts.
 */

/**
 * Collapses the whitespace a person actually produces: Windows line endings, trailing spaces on
 * each line, runs of spaces mid-sentence, and the four blank lines left by a pasted signature.
 *
 * Paragraph breaks survive as a single blank line, because they are meaning rather than noise.
 */
function normalizeMessage(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const name = (missing: string) =>
  z
    .string()
    .trim()
    .min(1, { error: missing })
    .max(FIELD_LIMITS.name, { error: CONTACT_ERRORS.nameTooLong });

export const contactSchema = z.strictObject({
  firstName: name(CONTACT_ERRORS.firstName),
  lastName: name(CONTACT_ERRORS.lastName),

  /**
   * Lowercased before validating, so `Nikos@Example.GR` and `nikos@example.gr` are one address.
   * The length cap runs first: RFC 5321 stops at 254 characters and there is no reason to run a
   * pattern over a megabyte of text somebody pasted.
   */
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(FIELD_LIMITS.email, { error: CONTACT_ERRORS.emailTooLong })
    .pipe(z.email({ error: CONTACT_ERRORS.email })),

  /**
   * Optional, and only validated once there is something to validate. Missing, empty and
   * whitespace-only all mean the same thing and all normalize to `undefined`, so nothing downstream
   * has to decide whether `''` counts as a telephone number.
   *
   * The value is kept exactly as it was typed. The legacy form stripped every non-digit on each
   * keystroke, which rewrote `+30 210 612 9896` under the visitor's cursor.
   */
  telephone: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? '')
    .refine((value) => value === '' || TELEPHONE_PATTERN.test(value), {
      error: CONTACT_ERRORS.telephone,
    })
    .transform((value) => (value === '' ? undefined : value)),

  /**
   * The empty string is accepted as an *input* and then rejected, rather than being excluded from
   * the type outright.
   *
   * That is not a loosening. The `<select>` genuinely starts with no choice made, so `''` is a real
   * state of the control, and modelling it here is what lets the island's form values be exactly
   * `z.input` of this schema with no cast between them. The `transform` is sound because the
   * `refine` above it has already ruled the empty case out.
   */
  enquiryType: z
    .literal('')
    .or(z.enum(ENQUIRY_TYPE_VALUES))
    .refine((value) => value !== '', { error: CONTACT_ERRORS.enquiryType })
    .transform((value) => value as EnquiryTypeValue),

  /**
   * Three separate messages rather than one, because "too short" and "you have not written
   * anything" are different problems and telling somebody the wrong one is worse than saying
   * nothing. Length is measured after normalization, so twenty newlines are not a message.
   */
  message: z
    .string()
    .transform(normalizeMessage)
    .pipe(
      z.string().superRefine((value, ctx) => {
        if (value.length === 0) {
          ctx.addIssue({ code: 'custom', message: CONTACT_ERRORS.message });
        } else if (value.length < FIELD_LIMITS.messageMin) {
          ctx.addIssue({ code: 'custom', message: CONTACT_ERRORS.messageTooShort });
        } else if (value.length > FIELD_LIMITS.messageMax) {
          ctx.addIssue({ code: 'custom', message: CONTACT_ERRORS.messageTooLong });
        }
      }),
    ),

  /**
   * Must be ticked. A boolean that has to be `true`, rather than the literal `true`, for the same
   * reason as `enquiryType`: the checkbox starts unticked, so `false` is a real state of the
   * control. A string `"true"` or a `1` from a hand-built payload still fails the type check.
   */
  privacy: z
    .boolean({ error: CONTACT_ERRORS.privacy })
    .refine((value) => value, { error: CONTACT_ERRORS.privacy }),

  /**
   * The honeypot, and the reason it is merely *accepted* here rather than required to be empty.
   *
   * A schema violation produces a field-level error naming the field that failed, which tells a bot
   * precisely which input to leave alone next time. So the schema treats this as an ordinary
   * optional string, and `guards.ts` decides what a filled one means, out of the visitor's sight.
   * The only job this line has is to stop `strictObject` rejecting the payload for carrying it.
   */
  website: z.string().optional(),

  /**
   * When the form was rendered, as milliseconds. The elapsed-time check needs to know "now" and so
   * belongs to the request rather than to the payload; `guards.ts` owns it.
   */
  renderedAt: z.number().int().positive(),
});

/** What arrives on the wire, before trimming, lowercasing and normalization. */
export type ContactInput = z.input<typeof contactSchema>;

/** What both ends work with afterwards. `telephone` is `string | undefined`, never `''`. */
export type ContactPayload = z.output<typeof contactSchema>;

/** The visitor-facing fields, which are the only ones that can show an error under a control. */
export type ContactFieldName = Exclude<keyof ContactInput, 'website' | 'renderedAt'>;

export type ContactFieldErrors = Partial<Record<ContactFieldName, string>>;

export type ContactParseResult =
  | { ok: true; data: ContactPayload }
  | { ok: false; errors: ContactFieldErrors };

/**
 * Parses a payload and flattens the failure into one message per field.
 *
 * One message, not all of them: a control can only usefully show a single error, and the first is
 * the one that describes the actual problem. Both the island and the endpoint call this, so the
 * text a visitor sees inline and the text the server would have produced are the same string.
 */
export function parseContact(payload: unknown): ContactParseResult {
  const result = contactSchema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };

  const errors: ContactFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field !== 'string') continue;
    if (field === 'website' || field === 'renderedAt') continue;

    const key = field as ContactFieldName;
    if (!errors[key]) errors[key] = issue.message;
  }

  return { ok: false, errors };
}
