// Branded HTML email for form submissions (api/forms.ts). Same language as the site: ink band with the
// white/orange HTG mark, Bebas headings, square corners, orange accents. Built with tables and inline
// styles because that is what email clients render reliably; Bebas loads where the client allows web fonts
// (Apple Mail, iOS) and falls back to a condensed system face elsewhere (Gmail, Outlook).
// Every value a visitor typed goes through esc(), so nothing they send can become markup.

const INK = '#111111';
const ORANGE = '#E75D18';
const PAPER = '#FAF8F6';
const TEXT = '#474343';
const LABEL = '#5E5555';
const BORDER = '#E4DEDA';
const DISPLAY = "'Bebas Neue', Impact, 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
const BODY = "Montserrat, 'Helvetica Neue', Helvetica, Arial, sans-serif";

export type Row = [label: string, value: string];

export interface EmailParts {
  /** Small uppercase line above the title, e.g. "Contact · Rental" or "Shop order". */
  kicker: string;
  title: string;
  rows: Row[];
  /** Optional emphasized line under the title (order total, reference). */
  highlight?: string;
  reply: { email: string; name: string; subject: string };
  /** Which form, for the footer. */
  formLabel: string;
  /** Site origin the request came from, so the logo loads from the same deployment. */
  origin: string;
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const lines = (s: string) => esc(s).replace(/\r?\n/g, '<br>');

export function renderEmail(p: EmailParts): string {
  const logo = `${p.origin}/brand/htg-mark-white.png`;
  const mailto = `mailto:${encodeURIComponent(p.reply.email)}?subject=${encodeURIComponent(p.reply.subject)}`;
  const sent = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const first = p.reply.name.split(/\s+/)[0] || 'them';

  const rows = p.rows
    .map(([label, value], i) => `
      <tr><td style="padding:${i ? 16 : 4}px 0 16px;border-bottom:1px solid ${BORDER};">
        <div style="font:600 11px/1.4 ${BODY};letter-spacing:.14em;text-transform:uppercase;color:${LABEL};padding-bottom:5px;">${esc(label)}</div>
        <div style="font:400 16px/1.55 ${BODY};color:${INK};word-break:break-word;">${value ? lines(value) : `<span style="color:${LABEL};">(none)</span>`}</div>
      </td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(p.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(`${p.kicker}: ${p.title}`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" style="padding:24px 12px 40px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

    <tr><td style="background:${INK};padding:22px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="76" style="vertical-align:middle;"><img src="${logo}" width="68" height="40" alt="HTG" style="display:block;border:0;width:68px;height:40px;"></td>
        <td style="vertical-align:middle;padding-left:14px;white-space:nowrap;font:400 24px/1 ${DISPLAY};letter-spacing:.12em;color:${ORANGE};text-transform:uppercase;">Holland Tunnel</td>
        <td align="right" style="vertical-align:middle;font:600 11px/1.3 ${BODY};letter-spacing:.14em;text-transform:uppercase;color:#BDB5B1;">Website<br>form</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${ORANGE};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

    <tr><td style="background:#ffffff;padding:30px 28px 8px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
      <div style="font:600 12px/1.4 ${BODY};letter-spacing:.16em;text-transform:uppercase;color:${INK};">
        <span style="display:inline-block;width:22px;height:3px;background:${ORANGE};vertical-align:middle;margin:-2px 10px 0 0;"></span>${esc(p.kicker)}
      </div>
      <h1 style="margin:10px 0 0;font:400 44px/.95 ${DISPLAY};letter-spacing:.02em;color:${INK};text-transform:uppercase;">${esc(p.title)}</h1>
      ${p.highlight ? `<p style="margin:12px 0 0;font:600 16px/1.4 ${BODY};color:${ORANGE};">${esc(p.highlight)}</p>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;"><tr>
        <td style="background:${ORANGE};"><a href="${mailto}" style="display:inline-block;padding:13px 24px 10px;font:400 22px/1 ${DISPLAY};letter-spacing:.06em;text-transform:uppercase;color:#ffffff;text-decoration:none;">Reply to ${esc(first)}</a></td>
      </tr></table>
      <p style="margin:0 0 6px;font:400 13px/1.5 ${BODY};color:${LABEL};">Or just hit reply: it goes to <a href="${mailto}" style="color:${INK};">${esc(p.reply.email)}</a>.</p>
    </td></tr>

    <tr><td style="background:#ffffff;padding:8px 28px 26px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:3px solid ${INK};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    </td></tr>

    <tr><td style="padding:18px 4px 0;font:400 12px/1.6 ${BODY};color:${LABEL};">
      Sent from the <b style="color:${TEXT};">${esc(p.formLabel)}</b> form on hollandtunnelgallery.com · ${esc(sent)} ET<br>
      Holland Tunnel Gallery · 46 Chambers Street, Newburgh, NY 12550
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}
