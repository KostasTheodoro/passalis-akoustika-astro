import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Page, test } from '@playwright/test';
import { buildOwnerNotification } from '../../src/emails/owner-notification';
import { buildVisitorAcknowledgement } from '../../src/emails/visitor-acknowledgement';
import type { ContactPayload } from '../../src/lib/forms/contact-schema';

/**
 * Captures the review artifacts for STEP-08: everything the maintainer has to *look at* rather than
 * read.
 *
 * Deliberately outside `tests/e2e`, so `bun run test:e2e` does not run it. It asserts almost
 * nothing on purpose: its job is to produce pictures and rendered emails, and a capture run that
 * failed an assertion would stop half way and leave the set incomplete.
 *
 * Run it with `bun run artifacts`, against a preview server.
 */

const OUT = process.env.ARTIFACT_DIR ?? 'artifacts/step-08';
const WIDTHS = [390, 768, 1280] as const;

/** Long enough to clear the minimum time-to-submit guard in `guards.ts`. */
const FILL_TIME_MS = 3_500;

test.describe.configure({ mode: 'serial' });

async function fill(page: Page, unique: string) {
  await page.getByLabel('Όνομα', { exact: false }).fill('Νίκος');
  await page.getByLabel('Επώνυμο', { exact: false }).fill('Παπαδόπουλος');
  await page.getByLabel('Email', { exact: false }).fill(`nikos+${unique}@example.gr`);
  await page.getByLabel('Τηλέφωνο', { exact: false }).fill('694 123 4567');
  await page.getByLabel('Θέμα επικοινωνίας', { exact: false }).selectOption('hearing-test');
  await page
    .getByLabel('Μήνυμα', { exact: false })
    .fill(`Θα ήθελα ραντεβού για έλεγχο ακοής. (${unique})`);
  await page.getByRole('checkbox').check();
}

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(OUT, 'emails'), { recursive: true });
});

for (const width of WIDTHS) {
  test(`form and map at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });

    await page.goto('/epikoinonia');
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `form-empty-${width}.png`), fullPage: true });

    await page.getByRole('button', { name: 'Αποστολή μηνύματος' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `form-errors-${width}.png`), fullPage: true });

    // The facade before and after. This pair is what the map decision gets taken against.
    await page.goto('/epikoinonia');
    const facade = page.locator('[data-map-facade]');
    await facade.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await facade.screenshot({ path: join(OUT, `map-before-${width}.png`) });

    await page.getByRole('button', { name: 'Άνοιγμα χάρτη' }).click();
    await page.waitForTimeout(3_000);
    await facade.screenshot({ path: join(OUT, `map-after-${width}.png`) });
  });
}

test('a filled form, and the result it produces', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });

  await page.goto('/epikoinonia');
  await fill(page, `artifact-${Date.now()}`);
  await page.screenshot({ path: join(OUT, 'form-filled-1280.png'), fullPage: true });

  await page.waitForTimeout(FILL_TIME_MS);
  await page.getByRole('button', { name: 'Αποστολή μηνύματος' }).click();

  // A build with no Resend key must say the message was not sent, not report success.
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: join(OUT, 'form-development-result-1280.png'), fullPage: true });
});

test('the privacy page', async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/politiki-aporritou');
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT, `privacy-${width}.png`), fullPage: true });
  }
});

test('both emails, rendered', async () => {
  const sample: ContactPayload = {
    firstName: 'Νίκος',
    lastName: 'Παπαδόπουλος',
    email: 'nikos@example.gr',
    telephone: '694 123 4567',
    enquiryType: 'hearing-test',
    message:
      'Καλησπέρα σας,\n\nθα ήθελα να κλείσω ραντεβού για έλεγχο ακοής. Είμαι διαθέσιμος τα απογεύματα.\n\nΕυχαριστώ.',
    privacy: true,
    website: '',
    renderedAt: Date.now(),
  };

  const owner = buildOwnerNotification(sample);
  const visitor = buildVisitorAcknowledgement(sample);

  writeFileSync(join(OUT, 'emails', 'owner-notification.html'), owner.html, 'utf8');
  writeFileSync(join(OUT, 'emails', 'owner-notification.txt'), owner.text, 'utf8');
  writeFileSync(join(OUT, 'emails', 'visitor-acknowledgement.html'), visitor.html, 'utf8');
  writeFileSync(join(OUT, 'emails', 'visitor-acknowledgement.txt'), visitor.text, 'utf8');

  writeFileSync(
    join(OUT, 'emails', 'subjects.txt'),
    [
      `Owner subject:   ${owner.subject}`,
      `Owner reply-to:  ${owner.replyTo}`,
      `Visitor subject: ${visitor.subject}`,
      '',
      'The owner notification is sent FROM the verified business sender, never from the visitor.',
      'The visitor address appears only as reply-to.',
    ].join('\n'),
    'utf8',
  );
});
