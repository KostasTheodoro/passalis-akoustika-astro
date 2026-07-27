import { expect, test } from '@playwright/test';
import { CONTACT, ENQUIRY_TYPES } from '../../src/data/contact';
import { ROUTES } from '../../src/data/routes';

/**
 * `/epikoinonia` and `/politiki-aporritou`.
 *
 * These are the first tests on this site that drive a hydrated React island, and the first that
 * exercise a real server endpoint: `scripts/preview-server.ts` serves the prerendered HTML and
 * hands `/api/contact` to the actual bundled function.
 *
 * **The form takes three seconds to become submittable.** `guards.ts` drops anything sent sooner
 * than a person could plausibly fill it in, so every test that submits waits first. That is the
 * guard working, not a flake.
 */

const MINIMUM_FILL_TIME_MS = 3_500;

/**
 * Waits for the island to hydrate before touching it.
 *
 * Not defensive padding: two tests here failed only in the full parallel run and passed in
 * isolation, which is the signature of a race rather than a bug. The island is `client:idle`, so
 * under load React attaches later, and a `fill()` that lands first writes into markup with no
 * listeners on it. The value appears, the blur does nothing, and the assertion that an error shows
 * fails against a form that was never wired up yet.
 *
 * Astro marks an island `ssr` until it hydrates and removes the attribute afterwards, so this waits
 * for the real thing rather than for an arbitrary timeout.
 */
async function hydrated(page: import('@playwright/test').Page) {
  await expect(page.locator('astro-island')).not.toHaveAttribute('ssr', '');
}

/**
 * Fills every required field with something valid, and with something **different every time**.
 *
 * The unique address and message are not cosmetic. `guards.ts` fingerprints email plus message and
 * drops a repeat within sixty seconds as a double-send, answering as though it were sent. Two tests
 * submitting identical text would therefore see the second one silently treated as a duplicate,
 * which looks like a broken form and is actually the guard doing its job.
 */
async function fillValidly(page: import('@playwright/test').Page, unique: string) {
  await hydrated(page);
  await page.getByLabel(CONTACT.form.fields.firstName.label, { exact: false }).fill('Νίκος');
  await page.getByLabel(CONTACT.form.fields.lastName.label, { exact: false }).fill('Παπαδόπουλος');
  await page.getByLabel('Email', { exact: false }).fill(`nikos+${unique}@example.gr`);
  await page
    .getByLabel(CONTACT.form.fields.enquiryType.label, { exact: false })
    .selectOption('hearing-test');
  await page
    .getByLabel(CONTACT.form.fields.message.label, { exact: false })
    .fill(`Θα ήθελα ραντεβού για έλεγχο ακοής, όποτε σας βολεύει. (${unique})`);
  await page.getByRole('checkbox').check();
}

test.describe('the contact page', () => {
  test('renders once, with one heading and no nested main', async ({ page }) => {
    const response = await page.goto(ROUTES.contact);
    expect(response?.status()).toBe(200);

    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(CONTACT.heading);
  });

  test('the shop details are readable without the form', async ({ page }) => {
    // The form needs JavaScript to submit, so on this page above all the telephone, email and
    // address must be present as a working alternative.
    await page.goto(ROUTES.contact);

    await expect(page.locator('main a[href^="tel:"]')).toHaveCount(1);
    await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(1);
  });

  test('every control has a visible, associated label', async ({ page }) => {
    await page.goto(ROUTES.contact);

    for (const field of [
      CONTACT.form.fields.firstName.label,
      CONTACT.form.fields.lastName.label,
      CONTACT.form.fields.telephone.label,
      CONTACT.form.fields.enquiryType.label,
      CONTACT.form.fields.message.label,
    ]) {
      await expect(page.getByLabel(field, { exact: false })).toBeVisible();
    }

    await expect(page.getByLabel('Email', { exact: false })).toBeVisible();
  });

  test('the enquiry menu offers exactly the approved options', async ({ page }) => {
    await page.goto(ROUTES.contact);

    const select = page.getByLabel(CONTACT.form.fields.enquiryType.label, { exact: false });
    const values = await select.locator('option').evaluateAll((options) =>
      options.map((option) => ({
        value: (option as HTMLOptionElement).value,
        label: option.textContent?.trim() ?? '',
      })),
    );

    // The first is the placeholder, which is disabled so it cannot be chosen back.
    expect(values[0]?.value).toBe('');
    expect(values.slice(1)).toEqual(ENQUIRY_TYPES.map((type) => ({ ...type })));
  });

  test('the telephone is the only optional field, and says so', async ({ page }) => {
    await page.goto(ROUTES.contact);

    const telephone = page.getByLabel(CONTACT.form.fields.telephone.label, { exact: false });
    await expect(telephone).not.toHaveAttribute('required', '');
    await expect(page.getByText(CONTACT.form.optional)).toBeVisible();
  });

  test('the privacy acknowledgement links to the privacy page', async ({ page }) => {
    await page.goto(ROUTES.contact);

    const link = page.locator(`main a[href="${ROUTES.privacy}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveText(CONTACT.form.privacy.linkLabel);
  });

  test('the health-data warning sits with the message box', async ({ page }) => {
    // It is in the privacy notice too, but this is where somebody is about to type it.
    await page.goto(ROUTES.contact);
    await expect(page.getByText(CONTACT.form.messageHint)).toBeVisible();
  });
});

test.describe('client validation', () => {
  test('an empty submit reports every required field and sends nothing', async ({ page }) => {
    let posted = false;
    page.on('request', (request) => {
      if (request.url().includes('/api/contact')) posted = true;
    });

    await page.goto(ROUTES.contact);
    await hydrated(page);
    await page.getByRole('button', { name: CONTACT.form.submit }).click();

    // Five controls use the shared message element: two names, email, enquiry type and message.
    await expect(page.locator('[data-slot="form-message"]:not(:empty)')).toHaveCount(5);

    // The privacy checkbox renders its own, because its label wraps a link rather than being a
    // single control. Matched on the full sentence: the words "Πολιτική Απορρήτου" alone also
    // appear in the label's link and in the footer.
    await expect(page.getByText('Πρέπει να αποδεχτείτε την Πολιτική Απορρήτου.')).toBeVisible();

    expect(posted, 'an invalid form was sent to the server').toBe(false);
  });

  test('an invalid control is marked invalid and described by its error', async ({ page }) => {
    await page.goto(ROUTES.contact);
    await hydrated(page);

    const email = page.getByLabel('Email', { exact: false });
    await email.fill('not-an-email');
    await email.blur();

    await expect(email).toHaveAttribute('aria-invalid', 'true');

    const describedBy = await email.getAttribute('aria-describedby');
    expect(describedBy, 'the invalid field describes nothing').toBeTruthy();

    // The error must be *reachable* from the control, not merely nearby on screen.
    const messageId = describedBy?.split(' ').find((id) => id.endsWith('message'));
    await expect(page.locator(`#${messageId}`)).not.toBeEmpty();
  });

  test('focus moves to the first field with a problem', async ({ page }) => {
    await page.goto(ROUTES.contact);
    await hydrated(page);
    await page.getByRole('button', { name: CONTACT.form.submit }).click();

    await expect(
      page.getByLabel(CONTACT.form.fields.firstName.label, { exact: false }),
    ).toBeFocused();
  });

  test('an error clears once the value is corrected', async ({ page }) => {
    await page.goto(ROUTES.contact);
    await hydrated(page);

    const email = page.getByLabel('Email', { exact: false });
    await email.fill('nope');
    await email.blur();
    await expect(email).toHaveAttribute('aria-invalid', 'true');

    // Blurred again, not merely retyped. The form validates on blur before a first submit, so an
    // error deliberately does not vanish mid-keystroke while somebody is still typing an address.
    await email.fill('nikos@example.gr');
    await email.blur();
    await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  });
});

/**
 * Every test here that actually reaches the server consumes one of the five submissions the rate
 * limiter allows per address per ten minutes, and they all arrive from the same address. So there
 * are deliberately few of them, and the assertions that would otherwise want their own submission
 * are grouped into one.
 *
 * The too-fast test is free: `guards.ts` runs before the limiter and returns early, so a dropped
 * submission never reaches it.
 */
test.describe('submitting', () => {
  test('a valid submission reports development mode, inline, and announced', async ({ page }) => {
    // The preview build has no Resend key, so the endpoint validates and builds both emails and
    // then deliberately does not send. It must say so: a green tick for a message that went
    // nowhere is how a broken contact form reaches production.
    await page.goto(ROUTES.contact);
    await fillValidly(page, 'dev-mode');
    await page.waitForTimeout(MINIMUM_FILL_TIME_MS);

    await page.getByRole('button', { name: CONTACT.form.submit }).click();

    const panel = page
      .locator('[role="status"]')
      .filter({ hasText: CONTACT.status.developmentTitle });

    // Inline, not only in a toast. DEC-016: if the toast were deleted the visitor must still be
    // told what happened, so the panel is what this asserts.
    await expect(panel).toBeVisible();

    // `role="status"` is implicitly `aria-live="polite"`, so the outcome is spoken rather than
    // silently swapped in under a keyboard user.
    await expect(panel).toHaveAttribute('aria-live', 'polite');

    // And it must never claim the message was sent.
    await expect(page.getByText(CONTACT.status.successTitle)).toHaveCount(0);
  });

  test('a submission faster than a person could manage is refused by the server', async ({
    page,
  }) => {
    await page.goto(ROUTES.contact);
    await fillValidly(page, 'too-fast');

    // No wait. The guard drops it, and answers as though it were sent, so a bot learns nothing
    // about which check it failed.
    const response = page.waitForResponse((r) => r.url().includes('/api/contact'));
    await page.getByRole('button', { name: CONTACT.form.submit }).click();

    expect((await response).status()).toBe(200);
  });
});

test.describe('the honeypot', () => {
  test('is present, hidden from everybody, and out of the tab order', async ({ page }) => {
    await page.goto(ROUTES.contact);

    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toHaveAttribute('tabindex', '-1');
    await expect(honeypot).not.toBeInViewport();

    // Hidden from the accessibility tree, so no screen reader will ever offer it.
    const hiddenByAria = await honeypot.evaluate((input) =>
      Boolean(input.closest('[aria-hidden="true"]')),
    );
    expect(hiddenByAria, 'the honeypot is exposed to assistive technology').toBe(true);
  });
});

test.describe('the map', () => {
  test('requests nothing from Google until the button is pressed', async ({ page }) => {
    const googleRequests: string[] = [];
    page.on('request', (request) => {
      if (/google|gstatic|googleapis/.test(request.url())) googleRequests.push(request.url());
    });

    await page.goto(ROUTES.contact);
    await page.waitForLoadState('networkidle');

    expect(googleRequests, `the map loaded on its own: ${googleRequests[0]}`).toHaveLength(0);
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('loads the embed once asked', async ({ page }) => {
    await page.goto(ROUTES.contact);
    await page.getByRole('button', { name: CONTACT.map.load }).click();

    const frame = page.locator('iframe');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute('title', /Χάρτης/);
  });

  test('offers a normal link out, so the embed is not the only route', async ({ page }) => {
    await page.goto(ROUTES.contact);

    const link = page.getByRole('link', { name: new RegExp(CONTACT.map.externalLabel) });
    await expect(link).toHaveAttribute('href', /google\.com\/maps/);
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('does not shift the layout when it loads', async ({ page }) => {
    await page.goto(ROUTES.contact);

    const box = page.locator('[data-map-facade]');
    const before = await box.boundingBox();

    await page.getByRole('button', { name: CONTACT.map.load }).click();
    await expect(page.locator('iframe')).toHaveCount(1);

    const after = await box.boundingBox();
    expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(2);
  });
});

test.describe('reduced motion', () => {
  test('the checkbox tick does not animate', async ({ page }) => {
    // The first animated component on the site. `global.css` zeroes every animation and transition
    // under `prefers-reduced-motion`, and this asserts that rather than trusting it.
    //
    // `emulateMedia` rather than a `test.use` fixture, so the preference is set on this one page
    // and the assertion sits next to the thing it is about.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ROUTES.contact);
    await hydrated(page);
    await page.getByRole('checkbox').check();

    const duration = await page
      .locator('[data-slot="checkbox-indicator"]')
      .evaluate((node) => getComputedStyle(node).animationDuration);

    expect(Number.parseFloat(duration), `the tick still animates for ${duration}`).toBeLessThan(
      0.05,
    );
  });
});

test.describe('the privacy page', () => {
  test('renders and is linked from the footer of every page', async ({ page }) => {
    const response = await page.goto(ROUTES.privacy);
    expect(response?.status()).toBe(200);

    await expect(page.locator('h1')).toHaveText('Πολιτική Απορρήτου');
    await expect(page.locator(`footer a[href="${ROUTES.privacy}"]`)).toHaveCount(1);
  });

  test('names the supervisory authority a visitor can complain to', async ({ page }) => {
    // GDPR Article 13(2)(d). A notice that lists rights without saying where to take a complaint
    // is missing the only part that is enforceable by the reader.
    await page.goto(ROUTES.privacy);

    await expect(page.locator('main')).toContainText('Αρχή Προστασίας Δεδομένων');
    await expect(page.locator('main a[href*="dpa.gr"]')).toHaveCount(1);
  });

  test('tells visitors not to send medical detail', async ({ page }) => {
    await page.goto(ROUTES.privacy);
    await expect(page.locator('main')).toContainText('ιατρικά στοιχεία');
  });

  test('renders the shop details from the one source', async ({ page }) => {
    // The page is `.mdx` precisely so these are interpolated rather than typed into a content file.
    await page.goto(ROUTES.privacy);

    await expect(page.locator('main')).toContainText('210 612 9896');
    await expect(page.locator('main')).not.toContainText('frontmatter.');
    await expect(page.locator('main')).not.toContainText('BUSINESS.');
  });
});
