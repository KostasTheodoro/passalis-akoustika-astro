import { BUSINESS, fullAddress } from '@/data/business';

/**
 * The pieces both email templates are built from.
 *
 * Everything a visitor typed passes through `escapeHtml` before it reaches HTML. That is not optional
 * politeness: the owner notification puts a stranger's free text into a document that opens in the
 * shop's own mail client, and the message body is the one field where somebody can write whatever
 * they like. Escaping happens here, once, rather than being remembered at each interpolation.
 */

/** The five characters that can change the meaning of surrounding markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Flattens a value for a subject line or a header.
 *
 * Newlines are the point. A `\r` or `\n` inside a header is how header injection works: text after
 * the break is read as a new header, which is what turns a name field into a way of adding
 * recipients. Everything is collapsed to spaces and the result is capped.
 */
export function headerSafe(value: string, limit = 120): string {
  const flat = value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

/** Turns a plain-text message into paragraphs, escaping as it goes. */
export function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px">${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

/**
 * The document shell.
 *
 * Deliberately plain: table-free, inline styles only, no web fonts, no external images. Mail
 * clients are not browsers, and the ones this shop's customers use are as likely to be a decade-old
 * Outlook as anything modern. A layout that degrades to readable text is worth more than one that
 * looks designed in three clients and breaks in the fourth.
 *
 * The teal is written as a literal here rather than read from a token, because a stylesheet
 * variable means nothing inside an email. It is `--color-brand-strong`, the same value the site
 * uses for text on white, and it is the one place in the project where that is the right call.
 */
export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px;background:#f7f7f6;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#464342">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e4e2e0;border-radius:16px;padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0e8083">${escapeHtml(title)}</h1>
${body}
</div>
<p style="max-width:600px;margin:16px auto 0;font-size:13px;line-height:1.5;color:#6e6a68">
${escapeHtml(BUSINESS.name)} &middot; ${escapeHtml(fullAddress)}<br />
${escapeHtml(BUSINESS.telephone.display)} &middot; ${escapeHtml(BUSINESS.email)}
</p>
</body>
</html>`;
}

/** The same closing block as plain text, for the multipart alternative. */
export function textFooter(): string {
  return [
    '',
    '---',
    BUSINESS.name,
    fullAddress,
    `Τηλέφωνο: ${BUSINESS.telephone.display}`,
    `Email: ${BUSINESS.email}`,
    `Ωράριο: ${BUSINESS.openingHours.display}`,
  ].join('\n');
}

/** One labelled row, for the owner's notification. */
export function row(label: string, value: string): string {
  return `<tr>
<td style="padding:6px 12px 6px 0;vertical-align:top;font-weight:bold;white-space:nowrap;color:#464342">${escapeHtml(label)}</td>
<td style="padding:6px 0;vertical-align:top;color:#464342">${escapeHtml(value)}</td>
</tr>`;
}
