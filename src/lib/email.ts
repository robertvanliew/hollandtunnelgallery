// Branded HTML emails for the forms (api/forms.ts): one to the gallery with the submission, one to the
// visitor saying it arrived. Same language as the site: ink band with the HTG lockup, orange accents,
// square corners. Written for email clients, not browsers:
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
const INFO = 'info@hollandtunnelgallery.com';

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
  /** Site origin the request came from, so images and links point at the same deployment. */
  origin: string;
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const lines = (s: string) => esc(s).replace(/\r?\n/g, '<br>');
const mailto = (email: string, subject?: string) =>
  `mailto:${encodeURIComponent(email)}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
const link = (href: string, text: string, color = INK) =>
  `<a href="${esc(href)}" style="color:${color};text-decoration:underline;">${esc(text)}</a>`;
const P = (size: number, line: number, extra = '') =>
  `font-family:${SANS};font-size:${size}px;line-height:${line}px;${extra}`;

/** The visitor's own words are shown first, as a quote; everything else follows as labeled rows. */
const QUOTE = new Set(['Message', 'Note', 'Bio / corrections', 'Notes']);

// ---- shared pieces ---------------------------------------------------------------------------------

/** Black band with the HTG lockup, white card, footer. `card` and `footer` are trusted HTML. */
function frame(o: { origin: string; title: string; preview: string; card: string; footer: string }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
<title>${esc(o.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(o.preview)}${'&zwnj;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAPER};">
<tr><td align="center" style="padding:24px 12px 40px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td style="background-color:${INK};padding:24px 28px;">
      <a href="${o.origin}/" style="text-decoration:none;"><img src="${o.origin}/brand/email-header.png" width="403" height="58" alt="Holland Tunnel Gallery, founded by Paulien Lethen"
        style="display:block;border:0;width:403px;max-width:100%;height:auto;${P(18, 24, `font-weight:700;color:${ORANGE};`)}"></a>
    </td></tr>
    <tr><td style="background-color:${ORANGE};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="background-color:#ffffff;padding:30px 28px 26px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};border-bottom:3px solid ${INK};">${o.card}
    </td></tr>
    <tr><td style="padding:18px 4px 0;${P(12, 19, `color:${LABEL};`)}">${o.footer}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

const heading = (kicker: string, title: string) => `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="22" valign="middle" style="width:22px;vertical-align:middle;"><div style="height:3px;line-height:3px;font-size:0;background-color:${ORANGE};">&nbsp;</div></td>
        <td style="padding-left:10px;${P(12, 16, `font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${INK};`)}">${esc(kicker)}</td>
      </tr></table>
      <h1 style="margin:12px 0 0;${P(24, 30, `font-weight:700;color:${INK};`)}">${esc(title)}</h1>`;

const button = (href: string, text: string) => `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>
        <td style="background-color:${ORANGE};">
          <a href="${esc(href)}" style="display:inline-block;padding:14px 24px;${P(14, 16, 'font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;')}">${esc(text)}</a>
        </td>
      </tr></table>`;

/** Labeled rows. `html` values must already be safe markup (our own links); `text` is escaped. */
const rowsTable = (rows: { label: string; text?: string; html?: string }[], top = 20) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:${top}px;">${rows
        .map((r) => `
        <tr><td style="padding-top:14px;padding-bottom:14px;border-bottom:1px solid ${BORDER};">
          <p style="margin:0 0 4px;${P(11, 16, `font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${LABEL};`)}">${esc(r.label)}</p>
          <p style="margin:0;${P(16, 24, `color:${INK};word-break:break-word;`)}">${r.html ?? lines(r.text ?? '')}</p>
        </td></tr>`)
        .join('')}
      </table>`;

const para = (html: string, top = 14) => `
      <p style="margin:${top}px 0 0;${P(16, 25, `color:${INK};`)}">${html}</p>`;

const footerAddress = `Holland Tunnel Gallery · founded by Paulien Lethen · ${link(MAPS, '46 Chambers Street, Newburgh, NY 12550', LABEL)}`;

// ---- to the gallery: one email per form submission ---------------------------------------------------

export function renderEmail(p: EmailParts): string {
  const reply = mailto(p.reply.email, p.reply.subject);
  const sent = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  // Full name on the button when it fits ("Reply to Jane Rivera"); very long names shorten to the first word.
  const full = p.reply.name.replace(/\s+/g, ' ').trim();
  const first = full.includes('@') ? '' : full.length <= 24 ? full : full.split(' ')[0];
  const quote = p.rows.find(([label, value]) => QUOTE.has(label) && value);
  const rows = p.rows.filter((r) => r !== quote && r[1]); // optional fields left blank are simply not shown

  const card = `${heading(p.kicker, p.title)}
      ${p.highlight ? `<p style="margin:8px 0 0;${P(15, 22, `font-weight:700;color:${ORANGE};`)}">${esc(p.highlight)}</p>` : ''}
      ${quote ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>
        <td style="border-left:3px solid ${ORANGE};background-color:${PAPER};padding:14px 18px;${P(16, 25, `color:${INK};word-break:break-word;`)}">${lines(quote[1])}</td>
      </tr></table>` : ''}
      ${button(reply, `Reply${first ? ` to ${first}` : ''}`)}
      <p style="margin:10px 0 0;${P(13, 20, `color:${LABEL};`)}">Or just hit reply: it goes to ${link(reply, p.reply.email)}.</p>
      ${rowsTable(rows.map(([label, v]) => (label === 'Email' && v === p.reply.email ? { label, html: link(mailto(v), v) } : { label, text: v })))}`;

  return frame({
    origin: p.origin,
    title: p.title,
    preview: (quote?.[1] ?? p.title).replace(/\s+/g, ' ').slice(0, 140),
    card,
    footer: `
      Sent from the <b style="color:${INK};">${esc(p.formLabel)}</b> form on ${link('https://www.hollandtunnelgallery.com', 'hollandtunnelgallery.com', LABEL)}<br>
      ${esc(sent)} ET<br>
      ${footerAddress}`,
  });
}

// ---- to the visitor: "we got it" -------------------------------------------------------------------
// Anyone can type any address into a form, so this email never repeats what the visitor wrote (no
// message, none of their links): only the gallery's own words, a first name that passes a strict
// check, and for shop orders the item details taken from the shop data. That keeps the forms from
// being used to deliver someone else's text to strangers.

export type ConfirmKind = 'contact' | 'school-visit' | 'rental-inquiry' | 'claim-profile' | 'shop-order' | 'newsletter';

export interface ConfirmParts {
  kind: ConfirmKind;
  name: string;
  origin: string;
  order?: { ref: string; item: string; quantity: string; total: string; pickup: boolean };
}

const COPY: Record<ConfirmKind, { kicker: string; title: string; body: string; cta: [label: string, path: string] }> = {
  contact: {
    kicker: 'Message received',
    title: 'Thanks, we got your message',
    body: 'Your message reached Holland Tunnel Gallery. We will write back to this email address as soon as possible.',
    cta: ['See what’s on', '/'],
  },
  'school-visit': {
    kicker: 'School visit request',
    title: 'Thanks, we got your request',
    body: 'Your school visit request reached Holland Tunnel Gallery. We will write back to this email address as soon as possible to plan the dates and the visit.',
    cta: ['About school visits', '/schools'],
  },
  'rental-inquiry': {
    kicker: 'Rental inquiry',
    title: 'Thanks, we got your rental inquiry',
    body: 'Your inquiry reached Holland Tunnel Gallery. Paulien will write back to this email address as soon as possible with availability and rates.',
    cta: ['See the space', '/rent'],
  },
  'claim-profile': {
    kicker: 'Artist profile',
    title: 'Thanks, we got your update',
    body: 'Your artist profile request reached Holland Tunnel Gallery. Paulien reviews every change before it appears on the site, and we will write back to this email address as soon as possible.',
    cta: ['Browse the artists', '/artists'],
  },
  'shop-order': {
    kicker: 'Order request received',
    title: 'Thanks, we got your order request',
    body: 'Your order request reached Holland Tunnel Gallery. No payment has been taken: we will email you as soon as possible to confirm the total and arrange payment and delivery.',
    cta: ['Back to the shop', '/shop'],
  },
  newsletter: {
    kicker: 'Newsletter',
    title: 'Thanks for signing up',
    body: 'You will hear from Holland Tunnel Gallery about new exhibitions, concerts and events in Newburgh.',
    cta: ['See what’s on', '/'],
  },
};

/** Only a plain first name is ever echoed back to the visitor; anything else becomes "Hi there". */
export const safeFirstName = (name: string) => {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return /^\p{L}[\p{L}'’-]{0,23}$/u.test(first) ? first : '';
};

export function renderConfirmation(c: ConfirmParts): { subject: string; html: string; text: string } {
  const copy = COPY[c.kind];
  const first = safeFirstName(c.name);
  const hi = first ? `Hi ${first},` : 'Hi there,';
  const o = c.order;
  const orderRows = o
    ? [
        { label: 'Reference', text: o.ref },
        { label: 'Item', text: o.item },
        { label: 'Quantity', text: o.quantity },
        { label: 'Total', text: o.total },
        { label: 'Delivery', text: o.pickup ? 'Pick up at the gallery' : 'Ship within the USA' },
      ]
    : [];

  const card = `${heading(copy.kicker, copy.title)}
      ${para(esc(hi), 18)}
      ${para(esc(copy.body))}
      ${o ? rowsTable(orderRows) : ''}
      ${button(c.origin + copy.cta[1], copy.cta[0])}
      ${rowsTable([
        { label: 'Visit', html: `Open Saturday &amp; Sunday, 1–5 pm · free<br>${link(MAPS, '46 Chambers Street, Newburgh, NY')}` },
        { label: 'Questions', html: `Reply to this email, or write to ${link(`mailto:${INFO}`, INFO)}` },
      ], 26)}`;

  const subject = o ? `We got your order request ${o.ref} · Holland Tunnel Gallery` : `${copy.title} · Holland Tunnel Gallery`;
  const notYou = 'You are getting this because this address was entered on a form at hollandtunnelgallery.com. If that wasn’t you, you can ignore this email.';
  const html = frame({
    origin: c.origin,
    title: copy.title,
    preview: copy.body,
    card,
    footer: `
      ${esc(notYou)}<br>
      ${footerAddress}`,
  });
  const text = [
    hi,
    copy.body,
    ...(o ? [orderRows.map((r) => `${r.label}: ${r.text}`).join('\n')] : []),
    'Visit: open Saturday & Sunday, 1–5 pm, free. 46 Chambers Street, Newburgh, NY',
    `Questions: reply to this email, or write to ${INFO}`,
    'Holland Tunnel Gallery',
    notYou,
  ].join('\n\n');
  return { subject, html, text };
}
