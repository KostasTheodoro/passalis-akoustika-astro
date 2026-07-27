import { beforeEach, describe, expect, test } from 'bun:test';
import { BUSINESS } from '@/data/business';
import { ENQUIRY_TYPE_LABELS } from '@/data/contact';
import { buildOwnerNotification } from '@/emails/owner-notification';
import { escapeHtml, headerSafe } from '@/emails/shared';
import { buildVisitorAcknowledgement } from '@/emails/visitor-acknowledgement';
import type { ContactPayload } from '@/lib/forms/contact-schema';
import { checkPayload, checkRequest, hashIp, resetSubmissionHistory } from '@/lib/forms/guards';
import { deliverContact, resetAcknowledgements, type Transport } from '@/lib/forms/mailer';
import { checkRateLimit, RATE_LIMIT, resetRateLimits } from '@/lib/forms/rate-limit';

/**
 * The server side of the contact form: guards, limiter, mailer and both templates.
 *
 * **Nothing here can send a real email.** The tests that touch delivery inject a fake transport,
 * and the ones that do not pass a key at all take the no-send path. There is no configuration under
 * which this file reaches Resend.
 */

const NOW = 1_800_000_000_000;

function payload(overrides: Partial<ContactPayload> = {}): ContactPayload {
  return {
    firstName: 'Νίκος',
    lastName: 'Παπαδόπουλος',
    email: 'nikos@example.gr',
    // Deliberately not the shop's own number: the templates print that in every footer, so a
    // fixture sharing it would make "the visitor's telephone is absent" impossible to assert.
    telephone: '694 123 4567',
    enquiryType: 'hearing-test',
    message: 'Θα ήθελα να κλείσω ένα ραντεβού για έλεγχο ακοής.',
    privacy: true,
    website: '',
    renderedAt: NOW - 10_000,
    ...overrides,
  };
}

/** Records what it was asked to send and reports success. */
function fakeTransport() {
  const sent: Parameters<Transport['send']>[0][] = [];

  const transport: Transport = {
    async send(message) {
      sent.push(message);
      return { ok: true };
    },
  };

  return { transport, sent };
}

beforeEach(() => {
  resetSubmissionHistory();
  resetRateLimits();
  resetAcknowledgements();
});

describe('request guards', () => {
  const origin = 'https://passalis-akoustika.gr';

  function request(headers: Record<string, string>) {
    return new Request(`${origin}/api/contact`, { method: 'POST', headers });
  }

  test('a JSON request from this site is accepted', () => {
    expect(checkRequest(request({ 'content-type': 'application/json', origin }), origin)).toBe(
      true,
    );
  });

  test('a form-encoded post is rejected', () => {
    // A plain HTML form cannot produce a JSON content type, so this turns away the scripts that
    // simply POST at every URL they find.
    expect(
      checkRequest(
        request({ 'content-type': 'application/x-www-form-urlencoded', origin }),
        origin,
      ),
    ).toBe(false);
  });

  test('a post from another origin is rejected', () => {
    expect(
      checkRequest(
        request({ 'content-type': 'application/json', origin: 'https://evil.example' }),
        origin,
      ),
    ).toBe(false);
  });

  test('a missing origin is allowed', () => {
    // Some privacy tooling strips the header. Refusing those visitors would trade a real person
    // for no security, since the header is forgeable by anyone who cares.
    expect(checkRequest(request({ 'content-type': 'application/json' }), origin)).toBe(true);
  });
});

describe('payload guards', () => {
  test('an ordinary submission is accepted', () => {
    expect(checkPayload(payload(), NOW)).toEqual({ action: 'accept' });
  });

  test('a filled honeypot is dropped', () => {
    expect(checkPayload(payload({ website: 'https://spam.example' }), NOW)).toEqual({
      action: 'drop',
      reason: 'honeypot',
    });
  });

  test('a submission faster than a person could manage is dropped', () => {
    expect(checkPayload(payload({ renderedAt: NOW - 500 }), NOW)).toEqual({
      action: 'drop',
      reason: 'too-fast',
    });
  });

  test('a stamp from hours ago is dropped', () => {
    expect(checkPayload(payload({ renderedAt: NOW - 3 * 60 * 60 * 1_000 }), NOW)).toEqual({
      action: 'drop',
      reason: 'stale',
    });
  });

  test('the same message twice within the window is dropped once', () => {
    expect(checkPayload(payload(), NOW).action).toBe('accept');
    expect(checkPayload(payload(), NOW + 1_000)).toEqual({ action: 'drop', reason: 'duplicate' });
  });

  test('the same message again after the window is accepted', () => {
    expect(checkPayload(payload(), NOW).action).toBe('accept');
    expect(checkPayload(payload(), NOW + 120_000).action).toBe('accept');
  });

  test('a different message from the same person is not a duplicate', () => {
    expect(checkPayload(payload(), NOW).action).toBe('accept');
    expect(checkPayload(payload({ message: 'Κάτι εντελώς άλλο να ρωτήσω.' }), NOW).action).toBe(
      'accept',
    );
  });
});

describe('logging carries nothing personal', () => {
  test('a hashed address is not the address', () => {
    const hashed = hashIp('192.0.2.44');

    expect(hashed).not.toContain('192');
    expect(hashed).toHaveLength(12);
    expect(hashIp('192.0.2.44')).toBe(hashed);
    expect(hashIp('192.0.2.45')).not.toBe(hashed);
  });

  test('a missing address does not throw', () => {
    expect(hashIp(null)).toBe('unknown');
  });

  test('the endpoint never interpolates a personal field into a log line', async () => {
    // The legacy route logged the whole error object, message body included. This reads the
    // endpoint source and fails if any personal field name appears inside a console call.
    const source = await Bun.file('src/pages/api/contact.ts').text();
    const calls = source.match(/console\.\w+\([\s\S]*?\);/g) ?? [];

    expect(calls.length, 'no console calls found; has the endpoint moved?').toBeGreaterThan(0);

    for (const call of calls) {
      for (const field of ['firstName', 'lastName', 'email', 'telephone', 'message']) {
        expect(call.includes(field), `a log line references ${field}`).toBe(false);
      }
    }
  });
});

describe('the rate limiter', () => {
  test('it allows a normal number of submissions and then stops', async () => {
    const key = 'abc123';

    for (let attempt = 1; attempt <= RATE_LIMIT.maxRequests; attempt += 1) {
      const outcome = await checkRateLimit(key, NOW);
      expect(outcome.limited, `attempt ${attempt} was limited`).toBe(false);
    }

    expect((await checkRateLimit(key, NOW)).limited).toBe(true);
  });

  test('it falls back to memory rather than failing open', async () => {
    // `@vercel/firewall` cannot reach a firewall in the test environment, so this exercises the
    // fallback. The point is that the limit still applies and the source says which layer answered.
    const outcome = await checkRateLimit('fallback-key', NOW);
    expect(outcome.source).toBe('memory');
    expect(outcome.limited).toBe(false);
  });

  test('the window expires', async () => {
    const key = 'expiring';
    for (let attempt = 0; attempt <= RATE_LIMIT.maxRequests; attempt += 1) {
      await checkRateLimit(key, NOW);
    }
    expect((await checkRateLimit(key, NOW)).limited).toBe(true);

    expect((await checkRateLimit(key, NOW + RATE_LIMIT.windowMs + 1_000)).limited).toBe(false);
  });

  test('one visitor being limited does not limit another', async () => {
    for (let attempt = 0; attempt <= RATE_LIMIT.maxRequests; attempt += 1) {
      await checkRateLimit('noisy', NOW);
    }

    expect((await checkRateLimit('noisy', NOW)).limited).toBe(true);
    expect((await checkRateLimit('quiet', NOW)).limited).toBe(false);
  });
});

describe('the owner notification', () => {
  test('the visitor is the reply-to and never the sender', async () => {
    const { transport, sent } = fakeTransport();

    await deliverContact(
      payload(),
      {
        apiKey: 'test-key',
        recipient: 'owner@example.gr',
        senderEmail: 'noreply@passalis-akoustika.gr',
        senderName: 'Πασσαλής Ακουστικά',
      },
      transport,
      NOW,
    );

    const owner = sent[0];
    expect(owner, 'nothing was sent').toBeDefined();
    expect(owner?.from).toBe('Πασσαλής Ακουστικά <noreply@passalis-akoustika.gr>');
    expect(owner?.from).not.toContain('nikos@example.gr');
    expect(owner?.replyTo).toBe('nikos@example.gr');
    expect(owner?.to).toBe('owner@example.gr');
  });

  test('the subject carries the enquiry label and the name', () => {
    const built = buildOwnerNotification(payload());

    expect(built.subject).toContain(ENQUIRY_TYPE_LABELS['hearing-test']);
    expect(built.subject).toContain('Νίκος Παπαδόπουλος');
  });

  test('the telephone row is absent when no telephone was given', () => {
    const with_ = buildOwnerNotification(payload());
    const without = buildOwnerNotification(payload({ telephone: undefined }));

    expect(with_.html).toContain('694 123 4567');
    expect(with_.text).toContain('694 123 4567');

    // The shop's own number still appears in the footer, so the check is for the visitor's.
    expect(without.html).not.toContain('694 123 4567');
    expect(without.text).not.toContain('694 123 4567');
  });

  test('both an HTML and a plain-text part are produced', () => {
    const built = buildOwnerNotification(payload());

    expect(built.html).toStartWith('<!doctype html>');
    expect(built.text).toContain('Θα ήθελα να κλείσω');
    expect(built.text).not.toContain('<');
  });
});

describe('hostile input cannot escape the template', () => {
  const hostile = payload({
    firstName: '<script>alert(1)</script>',
    lastName: '"><img src=x onerror=alert(1)>',
    message: 'Γεια <b>σας</b> & καλή χρονιά\n\n<script>fetch("//evil")</script>',
  });

  test('a script tag in a name is escaped, not rendered', () => {
    const built = buildOwnerNotification(hostile);

    // The test is whether a *tag* can form, not whether the letters survive. `onerror=alert(1)`
    // remains as visible text and that is correct: with its angle brackets escaped it is a string
    // in a table cell, not an attribute on an element.
    expect(built.html).not.toContain('<script');
    expect(built.html).not.toContain('<img');
    expect(built.html).toContain('&lt;script&gt;');
    expect(built.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('a script tag in the message body is escaped', () => {
    const built = buildOwnerNotification(hostile);

    expect(built.html).not.toContain('<script>fetch');
    expect(built.html).toContain('&amp;');
  });

  test('the acknowledgement escapes the name it greets', () => {
    const built = buildVisitorAcknowledgement(hostile);

    expect(built.html).not.toContain('<script>');
    expect(built.html).toContain('&lt;script&gt;');
  });

  test('newlines cannot be injected into a subject line', () => {
    // Text after a bare newline in a header is read as a new header, which is how a name field
    // becomes a way of adding recipients.
    const injected = buildOwnerNotification(
      payload({ firstName: 'Νίκος\r\nBcc: victim@example.com', lastName: '' }),
    );

    expect(injected.subject).not.toContain('\n');
    expect(injected.subject).not.toContain('\r');
  });

  test('headerSafe caps a very long value', () => {
    expect(headerSafe('α'.repeat(500), 40)).toHaveLength(40);
  });

  test('escapeHtml covers the five characters that matter', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('the acknowledgement', () => {
  const config = {
    apiKey: 'test-key',
    recipient: 'owner@example.gr',
    senderEmail: 'noreply@passalis-akoustika.gr',
    senderName: 'Πασσαλής Ακουστικά',
  };

  test('it repeats the shop details and the enquiry type', () => {
    const built = buildVisitorAcknowledgement(payload());

    expect(built.html).toContain(BUSINESS.telephone.display);
    expect(built.html).toContain(BUSINESS.openingHours.display);
    expect(built.html).toContain(ENQUIRY_TYPE_LABELS['hearing-test']);
  });

  test('it does not echo the message body', () => {
    // It is sent to whatever address was submitted, and nobody has proved that address belongs to
    // them, so quoting the enquiry back could deliver a stranger's message to an inbox they own.
    const built = buildVisitorAcknowledgement(payload());

    expect(built.html).not.toContain('Θα ήθελα να κλείσω');
    expect(built.text).not.toContain('Θα ήθελα να κλείσω');
  });

  test('it promises a reply but never a time', () => {
    const built = buildVisitorAcknowledgement(payload());
    const words = `${built.html} ${built.text}`;

    for (const promise of ['24 ώρες', '48 ώρες', 'εντός', 'άμεσα', 'αυθημερόν']) {
      expect(words.includes(promise), `the acknowledgement promises "${promise}"`).toBe(false);
    }
  });

  test('it is sent after the owner notification, not before', async () => {
    const { transport, sent } = fakeTransport();
    await deliverContact(payload(), config, transport, NOW);

    expect(sent).toHaveLength(2);
    expect(sent[0]?.to).toBe('owner@example.gr');
    expect(sent[1]?.to).toBe('nikos@example.gr');
  });

  test('it is not sent when the owner notification fails', async () => {
    const failing: Transport = {
      async send() {
        return { ok: false };
      },
    };
    const result = await deliverContact(payload(), config, failing, NOW);

    expect(result.delivery).toBe('failed');
  });

  test('the same address is not acknowledged twice within the hour', async () => {
    // The acknowledgement goes to a submitter-chosen address, so without this cap the form is a
    // way to send somebody mail from the shop's verified domain, repeatedly.
    const first = fakeTransport();
    await deliverContact(payload(), config, first.transport, NOW);
    expect(first.sent).toHaveLength(2);

    const second = fakeTransport();
    await deliverContact(
      payload({ message: 'Μια δεύτερη, εντελώς διαφορετική ερώτηση.' }),
      config,
      second.transport,
      NOW + 60_000,
    );

    expect(second.sent, 'the visitor was acknowledged twice').toHaveLength(1);
    expect(second.sent[0]?.to).toBe('owner@example.gr');
  });
});

describe('the no-send development path', () => {
  test('with no API key nothing is sent and the result says so', async () => {
    const { transport, sent } = fakeTransport();

    const result = await deliverContact(
      payload(),
      { senderName: 'Πασσαλής Ακουστικά' },
      transport,
      NOW,
    );

    expect(result).toEqual({ delivery: 'skipped', because: 'no-api-key' });
    expect(sent, 'something was sent without a key').toHaveLength(0);
  });

  test('a missing recipient or sender is reported distinctly', async () => {
    const base = { apiKey: 'test-key', senderName: 'Πασσαλής Ακουστικά' };

    expect(await deliverContact(payload(), base, undefined, NOW)).toEqual({
      delivery: 'skipped',
      because: 'no-recipient',
    });

    expect(
      await deliverContact(payload(), { ...base, recipient: 'owner@example.gr' }, undefined, NOW),
    ).toEqual({ delivery: 'skipped', because: 'no-sender' });
  });

  test('skipped is never reported as sent', async () => {
    const result = await deliverContact(payload(), { senderName: 'x' }, undefined, NOW);
    expect(result.delivery).not.toBe('sent');
  });
});
