// Branded HTML email for form submissions (api/forms.ts). Same language as the site: ink band with the
// HTG lockup, orange accents, square corners. Written for email clients, not browsers:
// - tables and inline styles only, longhand font properties (Outlook ignores the `font:` shorthand);
// - no web fonts: Gmail and Outlook drop them, and Bebas fell back to Impact. The brand lockup is one 2x
//   image (public/brand/email-header.png, rendered in real Bebas), everything else is system sans;
// - emails and the street address are our own styled links, so Gmail does not auto-link them in blue.
// Every value a visitor typed goes through esc(), so nothing they send can become markup.

const INK = '#111111';
const ORANGE = '#E75D18';
const PAPER = '#FAF8F6';
const LABEL = '#5E5555';
const BORDER = '#E4DEDA';
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MAPS = 'https://www.google.com/maps/search/?api=1&query=Holland+Tunnel+Gallery+46+Chambers+Street+Newburgh+NY';

export type Row = [label: string, value: string];

export interface EmailParts {
  /** Small uppercase line above the title, e.g. "Contact · Rental" or "Shop order request · HT-…". */
  kicker: string;
  title: string;
  rows: Row[];
  /** Optional emphasized line under the title (order total). */
  highlight?: string;
  reply: { email: string; name: string; subject: string };
  /** Which form, for the footer. */
  formLabel: string;
  /** Site origin the request came from, so the header image loads from the same deployment. */
  origin: string;
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const lines = (s: string) => esc(s).replace(/\r?\n/g, '<br>');
const mailto = (email: string, subject?: string) =>
  `mailto:${encodeURIComponent(email)}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
const link = (href: string, text: string, color = INK) =>
  `<a href="${esc(href)}" style="color:${color};text-decoration:underline;">${esc(text)}</a>`;

/** The visitor's own words are shown first, as a quote; everything else follows as labeled rows. */
const QUOTE = new Set(['Message', 'Note', 'Bio / corrections', 'Notes']);

export function renderEmail(p: EmailParts): string {
  const reply = mailto(p.reply.email, p.reply.subject);
  const sent = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const first = p.reply.name.includes('@') ? '' : p.reply.name.split(/\s+/)[0];
  const quote = p.rows.find(([label, value]) => QUOTE.has(label) && value);
  const rows = p.rows.filter((r) => r !== quote && r[1]); // optional fields left blank are simply not shown
  const preview = (quote?.[1] ?? p.title).replace(/\s+/g, ' ').slice(0, 140);

  const value = (label: string, v: string) => {
    if (!v) return `<span style="color:${LABEL};">(none)</span>`;
    if (label === 'Email' && v === p.reply.email) return link(mailto(v), v);
    return lines(v);
  };
  const rowHtml = rows
    .map(([label, v]) => `
          <tr><td style="padding-top:14px;padding-bottom:14px;border-bottom:1px solid ${BORDER};">
            <p style="margin:0 0 4px;font-family:${SANS};font-size:11px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${LABEL};">${esc(label)}</p>
            <p style="margin:0;font-family:${SANS};font-size:16px;line-height:24px;color:${INK};word-break:break-word;">${value(label, v)}</p>
          </td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
<title>${esc(p.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preview)}${'&zwnj;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER};">
<tr><td align="center" style="padding:24px 12px 40px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

    <tr><td style="background-color:${INK};padding:24px 28px;">
      <img src="${p.origin}/brand/email-header.png" width="403" height="58" alt="Holland Tunnel Gallery, founded by Paulien Lethen"
        style="display:block;border:0;width:403px;max-width:100%;height:auto;font-family:${SANS};font-size:18px;font-weight:700;color:${ORANGE};">
    </td></tr>
    <tr><td style="background-color:${ORANGE};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

    <tr><td style="background-color:#ffffff;padding:30px 28px 10px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="22" valign="middle" style="width:22px;vertical-align:middle;"><div style="height:3px;line-height:3px;font-size:0;background-color:${ORANGE};">&nbsp;</div></td>
        <td style="padding-left:10px;font-family:${SANS};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${INK};">${esc(p.kicker)}</td>
      </tr></table>
      <h1 style="margin:12px 0 0;font-family:${SANS};font-size:24px;line-height:30px;font-weight:700;color:${INK};">${esc(p.title)}</h1>
      ${p.highlight ? `<p style="margin:8px 0 0;font-family:${SANS};font-size:15px;line-height:22px;font-weight:700;color:${ORANGE};">${esc(p.highlight)}</p>` : ''}
      ${quote ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>
        <td style="border-left:3px solid ${ORANGE};background-color:${PAPER};padding:14px 18px;font-family:${SANS};font-size:16px;line-height:25px;color:${INK};word-break:break-word;">${lines(quote[1])}</td>
      </tr></table>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>
        <td style="background-color:${ORANGE};">
          <a href="${reply}" style="display:inline-block;padding:14px 24px;font-family:${SANS};font-size:14px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">Reply${first ? ` to ${esc(first)}` : ''}</a>
        </td>
      </tr></table>
      <p style="margin:10px 0 6px;font-family:${SANS};font-size:13px;line-height:20px;color:${LABEL};">Or just hit reply: it goes to ${link(mailto(p.reply.email, p.reply.subject), p.reply.email)}.</p>
    </td></tr>

    <tr><td style="background-color:#ffffff;padding:6px 28px 24px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:3px solid ${INK};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rowHtml}
      </table>
    </td></tr>

    <tr><td style="padding:18px 4px 0;font-family:${SANS};font-size:12px;line-height:19px;color:${LABEL};">
      Sent from the <b style="color:${INK};">${esc(p.formLabel)}</b> form on ${link('https://www.hollandtunnelgallery.com', 'hollandtunnelgallery.com', LABEL)}<br>
      ${esc(sent)} ET<br>
      Holland Tunnel Gallery · founded by Paulien Lethen · ${link(MAPS, '46 Chambers Street, Newburgh, NY 12550', LABEL)}
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}
