import { describe, expect, test } from 'bun:test';
import { CONTACT_ERRORS, ENQUIRY_TYPE_VALUES, FIELD_LIMITS } from '@/data/contact';
import { contactSchema, parseContact } from '@/lib/forms/contact-schema';

/**
 * The schema both the island and the endpoint import.
 *
 * The test worth reading first is "the legacy client/server mismatch cannot recur": that defect is
 * the reason this file exists, and it is the one acceptance criterion that a type cannot enforce
 * on its own.
 */

/**
 * A submission that should always be accepted. Each test changes exactly one thing about it.
 *
 * Overrides are deliberately untyped: most of the tests below exist to check what happens when a
 * value is the *wrong* type, which is precisely what a hand-built payload from outside the browser
 * would carry, and typing this parameter would make those cases impossible to write.
 */
function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: 'Νίκος',
    lastName: 'Παπαδόπουλος',
    email: 'nikos@example.gr',
    telephone: '210 612 9896',
    enquiryType: 'hearing-test',
    message: 'Θα ήθελα να κλείσω ένα ραντεβού για έλεγχο ακοής.',
    privacy: true,
    website: '',
    renderedAt: Date.now(),
    ...overrides,
  };
}

describe('the contact schema accepts a real submission', () => {
  test('a complete payload parses', () => {
    const result = parseContact(validPayload());
    expect(result.ok, `valid payload rejected: ${JSON.stringify(result)}`).toBe(true);
  });

  test('the telephone is genuinely optional', () => {
    for (const telephone of [undefined, '', '   ']) {
      const result = parseContact(validPayload({ telephone }));
      expect(result.ok, `telephone ${JSON.stringify(telephone)} was rejected`).toBe(true);
      if (result.ok) expect(result.data.telephone).toBeUndefined();
    }
  });

  test('every enquiry type in the menu is accepted', () => {
    for (const enquiryType of ENQUIRY_TYPE_VALUES) {
      expect(parseContact(validPayload({ enquiryType })).ok, `${enquiryType} was rejected`).toBe(
        true,
      );
    }
  });
});

describe('normalization', () => {
  test('names and email are trimmed, and the email is lowercased', () => {
    const result = parseContact(
      validPayload({
        firstName: '  Νίκος ',
        lastName: ' Παπαδόπουλος  ',
        email: '  Nikos@Example.GR ',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.firstName).toBe('Νίκος');
    expect(result.data.lastName).toBe('Παπαδόπουλος');
    expect(result.data.email).toBe('nikos@example.gr');
  });

  test('the telephone keeps the shape the visitor typed', () => {
    // The legacy form stripped every non-digit as the visitor typed, so "+30 210 612 9896" was
    // rewritten to "302106129896" under the cursor. Nothing here may reintroduce that.
    for (const typed of ['210 612 9896', '+30 210 612 9896', '(210) 612-9896', '6941234567']) {
      const result = parseContact(validPayload({ telephone: typed }));
      expect(result.ok, `${typed} was rejected`).toBe(true);
      if (result.ok) expect(result.data.telephone).toBe(typed);
    }
  });

  test('message whitespace is collapsed but paragraphs survive', () => {
    const result = parseContact(
      validPayload({
        message: '  Καλησπέρα   σας,\r\n\r\n\r\n\r\nθα ήθελα  πληροφορίες.   \r\n',
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.message).toBe('Καλησπέρα σας,\n\nθα ήθελα πληροφορίες.');
  });
});

describe('the schema rejects what it should', () => {
  test.each([
    ['firstName', '', CONTACT_ERRORS.firstName],
    ['firstName', '   ', CONTACT_ERRORS.firstName],
    ['lastName', '', CONTACT_ERRORS.lastName],
    ['email', 'not-an-email', CONTACT_ERRORS.email],
    ['email', '', CONTACT_ERRORS.email],
    ['telephone', 'τηλεφωνήστε μου', CONTACT_ERRORS.telephone],
    ['telephone', '12', CONTACT_ERRORS.telephone],
    ['message', '', CONTACT_ERRORS.message],
    ['message', 'Γεια', CONTACT_ERRORS.messageTooShort],
  ] as const)('%s = %p reports its own error', (field, value, expected) => {
    const result = parseContact(validPayload({ [field]: value }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[field]).toBe(expected);
  });

  test('a name or message beyond its limit is rejected', () => {
    const longName = parseContact(validPayload({ firstName: 'α'.repeat(FIELD_LIMITS.name + 1) }));
    expect(longName.ok).toBe(false);
    if (!longName.ok) expect(longName.errors.firstName).toBe(CONTACT_ERRORS.nameTooLong);

    const longMessage = parseContact(
      validPayload({ message: 'α'.repeat(FIELD_LIMITS.messageMax + 1) }),
    );
    expect(longMessage.ok).toBe(false);
    if (!longMessage.ok) expect(longMessage.errors.message).toBe(CONTACT_ERRORS.messageTooLong);
  });

  test('an enquiry type outside the menu is rejected', () => {
    for (const enquiryType of ['', 'ΤΕΣΤ ΑΚΟΗΣ', 'appointment', 'other ']) {
      expect(parseContact(validPayload({ enquiryType })).ok, `${enquiryType} was accepted`).toBe(
        false,
      );
    }
  });

  test('the privacy acknowledgement must be literally true', () => {
    // A hand-built payload sending the string "true", or 1, must not count as consent.
    for (const privacy of [false, 'true', 1, null, undefined]) {
      const result = parseContact(validPayload({ privacy }));
      expect(result.ok, `privacy ${JSON.stringify(privacy)} was accepted`).toBe(false);
      if (!result.ok) expect(result.errors.privacy).toBe(CONTACT_ERRORS.privacy);
    }
  });

  test('unexpected fields are rejected outright', () => {
    const result = contactSchema.safeParse({ ...validPayload(), isAdmin: true });
    expect(result.success, 'an unknown key was accepted').toBe(false);
  });

  test('renderedAt must be a positive integer', () => {
    for (const renderedAt of [undefined, 0, -1, 1.5, '1700000000000']) {
      expect(
        contactSchema.safeParse({ ...validPayload(), renderedAt }).success,
        `renderedAt ${JSON.stringify(renderedAt)} was accepted`,
      ).toBe(false);
    }
  });
});

describe('the legacy client/server mismatch cannot recur', () => {
  // The legacy form marked lastName required while `api/route.ts` validated only firstName, email
  // and message, so the server accepted a submission the form itself would never have produced.
  //
  // There is now one schema, so the useful assertion is that every field the form marks required is
  // required *here* — the single place both ends read.
  test.each(['firstName', 'lastName', 'email', 'enquiryType', 'message', 'privacy'] as const)(
    'omitting %s is rejected by the shared schema',
    (field) => {
      const payload = validPayload();
      delete payload[field];

      const result = parseContact(payload);
      expect(result.ok, `${field} is not actually required`).toBe(false);
      if (!result.ok) expect(result.errors[field], `${field} produced no message`).toBeTruthy();
    },
  );
});

describe('the honeypot stays invisible', () => {
  test('a filled honeypot produces no field error a bot could read', () => {
    // Rejecting it here would name the field in the response, which tells a bot exactly which
    // input to leave alone next time. `guards.ts` decides what a filled one means instead.
    const result = parseContact(validPayload({ website: 'https://spam.example' }));

    expect(result.ok, 'the schema should not judge the honeypot').toBe(true);
  });

  test('the honeypot value survives parsing so the guards can inspect it', () => {
    const result = parseContact(validPayload({ website: 'https://spam.example' }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.website).toBe('https://spam.example');
  });
});

describe('parseContact reports one message per field', () => {
  test('a payload wrong in three ways reports three errors', () => {
    const result = parseContact(
      validPayload({ firstName: '', email: 'nope', message: '', privacy: false }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(Object.keys(result.errors).sort()).toEqual(['email', 'firstName', 'message', 'privacy']);
    for (const [field, message] of Object.entries(result.errors)) {
      expect(typeof message, `${field} has no message`).toBe('string');
    }
  });
});
