import { BUSINESS, fullAddress } from '@/data/business';
import { ENQUIRY_TYPE_LABELS } from '@/data/contact';
import { escapeHtml, layout, row, textFooter } from '@/emails/shared';
import type { ContactPayload } from '@/lib/forms/contact-schema';

/**
 * What the visitor receives.
 *
 * Three constraints from `forms-and-email.md`, each of which changes what is written:
 *
 * 1. **No response time is promised.** The shop has not agreed to one, so the mail confirms receipt
 *    and says somebody will reply. Nothing says "within 24 hours".
 * 2. **The message body is not echoed.** An acknowledgement is sent to whatever address was
 *    submitted, and until somebody clicks the link in it, nobody has proved that address belongs to
 *    them. Quoting the message back would mean a stranger's enquiry could be delivered to an inbox
 *    they do not own. The enquiry *type* is repeated instead, which is enough to recognise it.
 * 3. **The shop's own details are repeated**, so the mail is useful on its own: somebody who wants
 *    to follow up by telephone does not have to find the site again.
 */
export interface VisitorAcknowledgement {
  subject: string;
  html: string;
  text: string;
}

export function buildVisitorAcknowledgement(payload: ContactPayload): VisitorAcknowledgement {
  const enquiry = ENQUIRY_TYPE_LABELS[payload.enquiryType];
  const subject = `Λάβαμε το μήνυμά σας | ${BUSINESS.name}`;

  const details = [
    row('Ωράριο', BUSINESS.openingHours.display),
    row('Τηλέφωνο', BUSINESS.telephone.display),
    row('Email', BUSINESS.email),
    row('Διεύθυνση', fullAddress),
  ].join('');

  const html = layout(
    'Λάβαμε το μήνυμά σας',
    `<p style="margin:0 0 12px">Γεια σας ${escapeHtml(payload.firstName)},</p>
<p style="margin:0 0 12px">Λάβαμε το μήνυμά σας με θέμα <strong>${escapeHtml(enquiry)}</strong> και θα σας απαντήσουμε σε αυτό το email.</p>
<p style="margin:0 0 20px">Αν προτιμάτε, μπορείτε να μας τηλεφωνήσετε ή να περάσετε από το κατάστημα.</p>
<table style="border-collapse:collapse;margin:0 0 12px">${details}</table>
<p style="margin:20px 0 0;font-size:13px;color:#6e6a68">Δεν χρειάζεται να απαντήσετε σε αυτό το μήνυμα.</p>`,
  );

  const text = [
    `Γεια σας ${payload.firstName},`,
    '',
    `Λάβαμε το μήνυμά σας με θέμα "${enquiry}" και θα σας απαντήσουμε σε αυτό το email.`,
    '',
    'Αν προτιμάτε, μπορείτε να μας τηλεφωνήσετε ή να περάσετε από το κατάστημα.',
    '',
    'Δεν χρειάζεται να απαντήσετε σε αυτό το μήνυμα.',
    textFooter(),
  ].join('\n');

  return { subject, html, text };
}
