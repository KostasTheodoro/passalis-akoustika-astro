import { buildOwnerNotification } from '@/emails/owner-notification';
import { buildVisitorAcknowledgement } from '@/emails/visitor-acknowledgement';
import type { ContactPayload } from '@/lib/forms/contact-schema';

/**
 * Sending, and not sending.
 *
 * The interesting half of this file is the no-send path. With no `RESEND_API_KEY`, everything still
 * happens: the payload is validated, the guards run, the limiter runs, and both emails are built in
 * full. Only the network call is skipped, and the result says `skipped` rather than `sent` so the
 * form can say so on screen.
 *
 * That is what makes the whole feature testable before there are production credentials, and it is
 * what makes "tests do not send real email" true by construction rather than by discipline: the
 * test environment has no key, so no code path can reach Resend.
 */

export interface MailerConfig {
  apiKey?: string;
  recipient?: string;
  senderEmail?: string;
  senderName: string;
}

export type DeliveryResult =
  | { delivery: 'sent' }
  | { delivery: 'skipped'; because: 'no-api-key' | 'no-recipient' | 'no-sender' }
  | { delivery: 'failed' };

/**
 * The one call this module makes to the outside world, behind an interface.
 *
 * Tests inject a fake. Nothing else about the module changes between a test and production, so what
 * the tests exercise is the real assembly and the real ordering.
 */
export interface Transport {
  send(message: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  }): Promise<{ ok: boolean }>;
}

/** The real one. Imported dynamically so `resend` is not loaded on the no-send path. */
export function resendTransport(apiKey: string): Transport {
  return {
    async send(message) {
      const { Resend } = await import('resend');
      const resend = new Resend(apiKey);

      const { error } = await resend.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      });

      return { ok: !error };
    },
  };
}

/**
 * Acknowledgements already sent, keyed by recipient.
 *
 * This is the cap that matters most on this endpoint. The acknowledgement goes to an address the
 * *submitter* chose, so without a per-address limit the form can be pointed at somebody's inbox and
 * used to send them mail from the shop's verified domain. Spam complaints would land against the
 * shop's sending reputation.
 */
const acknowledged = new Map<string, number>();
const ACKNOWLEDGEMENT_WINDOW_MS = 60 * 60 * 1_000;

function mayAcknowledge(email: string, now: number): boolean {
  const last = acknowledged.get(email);
  if (last && now - last < ACKNOWLEDGEMENT_WINDOW_MS) return false;

  for (const [address, at] of acknowledged) {
    if (now - at > ACKNOWLEDGEMENT_WINDOW_MS) acknowledged.delete(address);
  }

  acknowledged.set(email, now);
  return true;
}

/** Exposed for tests, which must not inherit state from each other. */
export function resetAcknowledgements(): void {
  acknowledged.clear();
}

/**
 * Builds both emails and, if it can, sends them.
 *
 * **The acknowledgement is sent only after the owner notification is accepted.** If the shop did not
 * get the enquiry, telling the visitor it arrived would be a lie, and the visitor is the one person
 * who could otherwise have tried again.
 */
export async function deliverContact(
  payload: ContactPayload,
  config: MailerConfig,
  transport?: Transport,
  now: number = Date.now(),
): Promise<DeliveryResult> {
  const owner = buildOwnerNotification(payload);
  const visitor = buildVisitorAcknowledgement(payload);

  if (!config.apiKey) return { delivery: 'skipped', because: 'no-api-key' };
  if (!config.recipient) return { delivery: 'skipped', because: 'no-recipient' };
  if (!config.senderEmail) return { delivery: 'skipped', because: 'no-sender' };

  const post = transport ?? resendTransport(config.apiKey);
  const from = `${config.senderName} <${config.senderEmail}>`;

  const sent = await post.send({
    from,
    to: config.recipient,
    subject: owner.subject,
    html: owner.html,
    text: owner.text,
    // The visitor's address, never the sender. A forged `from` is what the legacy route did.
    replyTo: owner.replyTo,
  });

  if (!sent.ok) return { delivery: 'failed' };

  if (mayAcknowledge(payload.email, now)) {
    // A failed acknowledgement is not a failed submission. The shop has the enquiry, which is the
    // part that matters, so the visitor is still told it arrived.
    await post
      .send({
        from,
        to: payload.email,
        subject: visitor.subject,
        html: visitor.html,
        text: visitor.text,
      })
      .catch(() => ({ ok: false }));
  }

  return { delivery: 'sent' };
}
