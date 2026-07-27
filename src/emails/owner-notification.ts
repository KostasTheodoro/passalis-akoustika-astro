import { ENQUIRY_TYPE_LABELS } from '@/data/contact';
import { headerSafe, layout, paragraphs, row, textFooter } from '@/emails/shared';
import type { ContactPayload } from '@/lib/forms/contact-schema';

/**
 * What the shop receives.
 *
 * The subject is built from a fixed template, the enquiry-type **label looked up from the enum**,
 * and the visitor's name flattened by `headerSafe`. The label comes from the lookup rather than
 * from the payload so nothing a submitter writes can reach the subject line unfiltered, and the
 * name has its newlines stripped, which is what stops a header-injection attempt in a name field.
 *
 * The visitor's address is the `replyTo` and nothing else. The legacy route set it as the `from`,
 * which is a forged sender: SPF and DKIM checks reject or spam-folder it, so the shop's own
 * enquiries were landing in junk. Replying still goes to the visitor, which is the behaviour that
 * was actually wanted.
 */
export interface OwnerNotification {
  subject: string;
  html: string;
  text: string;
  replyTo: string;
}

export function buildOwnerNotification(payload: ContactPayload): OwnerNotification {
  const name = headerSafe(`${payload.firstName} ${payload.lastName}`, 80);
  const enquiry = ENQUIRY_TYPE_LABELS[payload.enquiryType];

  const subject = `${enquiry}: ${name}`;

  const rows = [
    row('Όνομα', `${payload.firstName} ${payload.lastName}`),
    row('Email', payload.email),
    // Only present when the visitor gave one, rather than an empty row labelled "Τηλέφωνο".
    payload.telephone ? row('Τηλέφωνο', payload.telephone) : '',
    row('Θέμα', enquiry),
  ].join('');

  const html = layout(
    'Νέο μήνυμα από τη φόρμα επικοινωνίας',
    `<table style="border-collapse:collapse;margin:0 0 20px">${rows}</table>
<div style="border-top:1px solid #e4e2e0;padding-top:16px">
<p style="margin:0 0 8px;font-weight:bold;color:#464342">Μήνυμα</p>
${paragraphs(payload.message)}
</div>
<p style="margin:20px 0 0;font-size:13px;color:#6e6a68">Απαντήστε απευθείας σε αυτό το email για να επικοινωνήσετε με τον αποστολέα.</p>`,
  );

  const text = [
    'Νέο μήνυμα από τη φόρμα επικοινωνίας',
    '',
    `Όνομα: ${payload.firstName} ${payload.lastName}`,
    `Email: ${payload.email}`,
    payload.telephone ? `Τηλέφωνο: ${payload.telephone}` : null,
    `Θέμα: ${enquiry}`,
    '',
    'Μήνυμα:',
    payload.message,
    '',
    'Απαντήστε απευθείας σε αυτό το email για να επικοινωνήσετε με τον αποστολέα.',
    textFooter(),
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, html, text, replyTo: payload.email };
}
