import type { ContactFieldErrors } from '@/lib/forms/contact-schema';

/**
 * What `/api/contact` answers, shared by the endpoint that writes it and the island that reads it.
 *
 * A discriminated union rather than a bag of optional fields, so neither end can forget a case: add
 * an outcome here and every `switch` over it stops compiling until it is handled.
 *
 * **`delivery` is the part that matters most.** `sent` means Resend accepted the message; `skipped`
 * means the submission was valid and everything was built, but no key is configured so nothing was
 * sent. The two are never collapsed into one `ok: true`, because a green tick for a message that
 * went nowhere is precisely how a broken contact form reaches production unnoticed.
 */
export type ContactSuccess = {
  ok: true;
  delivery: 'sent' | 'skipped';
};

/**
 * `spam` is deliberately shaped like a success on the wire. A bot that trips the honeypot or the
 * timing check is told the message was sent, because telling it otherwise is free feedback about
 * which check it failed. The endpoint simply does not send anything.
 */
export type ContactFailure =
  | { ok: false; reason: 'validation'; errors: ContactFieldErrors }
  | { ok: false; reason: 'rate-limited' }
  | { ok: false; reason: 'server' };

export type ContactResponse = ContactSuccess | ContactFailure;

/** The HTTP status each outcome is sent with. */
export const CONTACT_STATUS = {
  ok: 200,
  validation: 422,
  rateLimited: 429,
  server: 500,
} as const;
