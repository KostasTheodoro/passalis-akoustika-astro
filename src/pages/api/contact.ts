import { PUBLIC_SITE_URL } from 'astro:env/client';
import {
  CONTACT_RECIPIENT_EMAIL,
  CONTACT_SENDER_EMAIL,
  CONTACT_SENDER_NAME,
  RESEND_API_KEY,
} from 'astro:env/server';
import type { APIRoute } from 'astro';
import { CONTACT_STATUS, type ContactResponse } from '@/lib/forms/contact-response';
import { parseContact } from '@/lib/forms/contact-schema';
import { checkPayload, checkRequest, hashIp } from '@/lib/forms/guards';
import { deliverContact } from '@/lib/forms/mailer';
import { checkRateLimit } from '@/lib/forms/rate-limit';

/**
 * The contact endpoint.
 *
 * `prerender = false` makes this the one route on the site that is a function rather than a file.
 * `technical-architecture.md` is explicit that a single dynamic endpoint must not turn the whole
 * site into a server-rendered application, and it does not: the other thirteen routes are still
 * static files on a CDN.
 *
 * The order below is deliberate and each step is cheaper than the one after it. Reject the obvious
 * before parsing, parse before rate-limiting, rate-limit before sending. Nothing expensive happens
 * for a request that was never going to be accepted.
 */
export const prerender = false;

function json(body: ContactResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Nothing here is cacheable, and a cached 429 would lock somebody out for its lifetime.
      'cache-control': 'no-store',
    },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!checkRequest(request, PUBLIC_SITE_URL)) {
    return json({ ok: false, reason: 'server' }, CONTACT_STATUS.server);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: 'server' }, CONTACT_STATUS.server);
  }

  const parsed = parseContact(body);
  if (!parsed.ok) {
    return json(
      { ok: false, reason: 'validation', errors: parsed.errors },
      CONTACT_STATUS.validation,
    );
  }

  const payload = parsed.data;
  const fingerprint = hashIp(clientAddress ?? null);

  const guard = checkPayload(payload);
  if (guard.action === 'drop') {
    // Answered as though it were sent. Telling a bot which check it failed is free advice about
    // how to pass next time, and a person who double-clicked gets the confirmation they expect
    // rather than an error for a message the shop already has.
    console.info(`contact: dropped (${guard.reason}) ip=${fingerprint}`);
    return json({ ok: true, delivery: 'sent' }, CONTACT_STATUS.ok);
  }

  const limit = await checkRateLimit(fingerprint);
  if (limit.limited) {
    console.info(`contact: rate limited via ${limit.source} ip=${fingerprint}`);
    return json({ ok: false, reason: 'rate-limited' }, CONTACT_STATUS.rateLimited);
  }

  try {
    const result = await deliverContact(payload, {
      apiKey: RESEND_API_KEY,
      recipient: CONTACT_RECIPIENT_EMAIL,
      senderEmail: CONTACT_SENDER_EMAIL,
      senderName: CONTACT_SENDER_NAME,
    });

    if (result.delivery === 'failed') {
      console.error(`contact: delivery failed type=${payload.enquiryType} ip=${fingerprint}`);
      return json({ ok: false, reason: 'server' }, CONTACT_STATUS.server);
    }

    // Enquiry type, a hashed address and the outcome. Never the name, the email, the telephone or
    // the message. The legacy route logged the whole error object, message body included.
    console.info(
      `contact: ${result.delivery} type=${payload.enquiryType} ip=${fingerprint}` +
        (result.delivery === 'skipped' ? ` because=${result.because}` : ''),
    );

    return json({ ok: true, delivery: result.delivery }, CONTACT_STATUS.ok);
  } catch {
    // The caught error is deliberately not logged. Everything it could carry is the visitor's own
    // details, and this is exactly where the legacy route leaked them.
    console.error(`contact: unexpected failure type=${payload.enquiryType} ip=${fingerprint}`);
    return json({ ok: false, reason: 'server' }, CONTACT_STATUS.server);
  }
};

/**
 * Anything that is not a POST.
 *
 * A bare 405 with `Allow` rather than a 404: the route exists, and saying so honestly is better
 * than pretending otherwise to somebody who typed the URL.
 */
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { allow: 'POST' } });
