// Form handler (Vercel function). Emails each submission to the gallery inbox via Resend.
// Nothing is published: Paulien reviews claim/update requests and applies them in the CMS.
import type { APIRoute } from 'astro';
import { FORMS_FROM, FORMS_TO, RESEND_API_KEY } from 'astro:env/server';
import { Resend } from 'resend';
import { EMAIL, PUBLIC_SITE } from '../../lib/site';
import { getProduct, money, MAX_QTY } from '../../lib/shop';
import { renderEmail, type Row } from '../../lib/email';

export const prerender = false;

const MAX_PHOTO = 4 * 1024 * 1024; // Vercel functions accept request bodies up to ~4.5 MB in total.
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const FORMS = {
  'claim-profile': {
    subject: (f: FormData) => `Artist profile claim/update: ${f.get('profile')} (from ${f.get('name')})`,
    required: ['name', 'email', 'profile', 'permission'],
    fields: [
      ['Name', 'name'],
      ['Email', 'email'],
      ['Profile', 'profile'],
      ['Links', 'links'],
      ['Bio / corrections', 'bio'],
      ['Permission to publish', 'permission'],
    ],
  },
  contact: {
    subject: (f: FormData) => `${f.get('topic') || 'Message'} · ${f.get('name')}`,
    required: ['name', 'email', 'message'],
    fields: [
      ['Topic', 'topic'],
      ['Sent from page', 'page'],
      ['Name', 'name'],
      ['Email', 'email'],
      ['Phone', 'phone'],
      ['School', 'school'],
      ['Grades', 'grades'],
      ['Number of students', 'students'],
      ['Date', 'date'],
      ['Number of people', 'guests'],
      ['They are', 'discipline'],
      ['Website / Instagram', 'website'],
      ['What they showed or played, and when', 'history'],
      ['Message', 'message'],
    ],
    skipEmpty: true,
  },
  'school-visit': {
    subject: (f: FormData) => `School visit request · ${f.get('school')} (${f.get('students')} students)`,
    required: ['name', 'email', 'school', 'grades', 'students'],
    fields: [
      ['Name', 'name'],
      ['Role', 'role'],
      ['Email', 'email'],
      ['Phone', 'phone'],
      ['School and district', 'school'],
      ['Grades', 'grades'],
      ['Number of students', 'students'],
      ['Preferred dates', 'dates'],
      ['Class or subject', 'subject'],
      ['Meet the artist', 'artist'],
      ['Funding', 'funding'],
      ['Notes', 'message'],
    ],
    skipEmpty: true,
  },
  // Shop order request: no payment here; the gallery replies to arrange payment and delivery.
  // Subject and body are built from the product data below (prices are never taken from the form).
  'shop-order': {
    subject: () => 'Shop order request',
    required: ['name', 'email', 'product', 'quantity', 'delivery'],
    fields: [],
  },
  newsletter: {
    subject: (f: FormData) => `Newsletter signup: ${f.get('email')}`,
    required: ['email'],
    fields: [['Email', 'email']],
  },
} as const;

type FormName = keyof typeof FORMS;
const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (req: Request, path: string) => Response.redirect(new URL(path, req.url), 303);
// The shop's order form asks for JSON so it can show the order summary in place; everything else redirects.
const wantsJson = (req: Request) => (req.headers.get('accept') ?? '').includes('application/json');
const done = (req: Request, extra: Record<string, unknown> = {}) =>
  wantsJson(req) ? Response.json({ ok: true, ...extra }) : back(req, '/thanks');
const orderRef = () => {
  const d = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '').slice(2);
  return `HT-${d}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('Could not read the form. Please try again.', { status: 400 });
  }
  const name = text(form, 'form-name') as FormName;
  const spec = FORMS[name];
  if (!spec) return new Response('Unknown form.', { status: 400 });
  if (text(form, 'company')) return back(request, '/thanks'); // honeypot: quietly drop bots

  const missing = spec.required.filter((k) => !text(form, k));
  const email = text(form, 'email');
  if (missing.length || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return new Response(`Please fill in: ${missing.join(', ') || 'a valid email'}.`, { status: 422 });

  const attachments: { filename: string; content: Buffer }[] = [];
  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    if (!PHOTO_TYPES.has(photo.type)) return new Response('Photos must be JPG, PNG or WebP.', { status: 422 });
    if (photo.size > MAX_PHOTO) return new Response('Photos must be under 4 MB.', { status: 413 });
    attachments.push({ filename: photo.name.replace(/[^\w.\-]+/g, '_'), content: Buffer.from(await photo.arrayBuffer()) });
  }

  const who = text(form, 'name') || email;
  let rows: Row[] = spec.fields
    .filter(([, key]) => !('skipEmpty' in spec) || text(form, key))
    .map(([label, key]) => [label, text(form, key)]);
  let subject: string = spec.subject(form);
  let ref: string | undefined;
  let highlight: string | undefined;
  // Headline for the branded email; the subject line stays as it was so inbox search keeps working.
  const heads: Record<FormName, () => [kicker: string, title: string, label: string]> = {
    'claim-profile': () => ['Artist profile', text(form, 'profile') || who, 'artist profile'],
    contact: () => [`Contact · ${text(form, 'topic') || 'Message'}`, `Message from ${who}`, 'contact'],
    'school-visit': () => ['School visit', text(form, 'school') || who, 'school visit'],
    'shop-order': () => ['Shop order request', who, 'shop'],
    newsletter: () => ['Newsletter', 'New subscriber', 'newsletter'],
  };
  let [kicker, title, formLabel] = heads[name]();

  if (name === 'shop-order') {
    // Check everything against the shop data; the price comes from src/lib/shop.ts, never from the form.
    const product = getProduct(text(form, 'product'));
    const qty = Number(text(form, 'quantity'));
    const option = text(form, 'option');
    const delivery = text(form, 'delivery');
    const address = text(form, 'address');
    if (!product) return new Response('That item is no longer in the shop.', { status: 422 });
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY)
      return new Response(`Please choose a quantity from 1 to ${MAX_QTY}.`, { status: 422 });
    if (product.options && !product.options.values.includes(option))
      return new Response(`Please choose a ${product.options.label.toLowerCase()}.`, { status: 422 });
    if (delivery !== 'ship' && delivery !== 'pickup') return new Response('Please choose shipping or pickup.', { status: 422 });
    if (delivery === 'ship' && !address) return new Response('Please add a shipping address.', { status: 422 });
    ref = orderRef();
    const item = `${product.title}${product.options ? ` (${product.options.label}: ${option})` : ''}`;
    const total = `${money(qty * product.price)}${delivery === 'ship' ? ' + shipping' : ''}`;
    subject = `Shop order request ${ref}: ${qty} × ${product.title} (${who})`;
    kicker = `Shop order request · ${ref}`;
    title = `${qty} × ${product.title}`;
    highlight = `${total} · ${delivery === 'ship' ? 'ship within the USA' : 'pickup at the gallery'} · no payment taken yet`;
    rows = [
      ['Reference', ref],
      ['Item', item],
      ['Quantity', `${qty} × ${money(product.price)} = ${total}`],
      ['Delivery', delivery === 'ship' ? `Ship to:\n${address}` : 'Pick up at the gallery'],
      ['Name', text(form, 'name')],
      ['Email', email],
      ['Phone', text(form, 'phone')],
      ['Note', text(form, 'note')],
    ];
  }

  const body = [
    ...(ref ? [`Order request ${ref}`] : []),
    ...rows.map(([label, value]) => `${label}:\n${value || '(none)'}`),
    ...(ref ? ['No payment has been taken. Reply to this email to arrange payment and delivery.'] : []),
  ].join('\n\n');
  const html = renderEmail({
    kicker, title, rows, highlight, formLabel,
    reply: { email, name: who, subject: `Re: ${subject}` },
    origin: new URL(request.url).origin,
  });

  if (!RESEND_API_KEY) {
    // Private demo without email configured: accept and log so the flow can be tried end to end.
    if (!PUBLIC_SITE) {
      console.warn(`[forms] RESEND_API_KEY not set; ${name} submission not emailed:\n${body}`);
      return done(request, { ref });
    }
    return new Response(`Form delivery is not configured yet. Please email ${EMAIL}.`, { status: 503 });
  }

  const { error } = await new Resend(RESEND_API_KEY).emails.send({
    from: FORMS_FROM,
    to: FORMS_TO,
    replyTo: email,
    subject,
    text: `${body}\n\n(Sent from the ${name} form on hollandtunnelgallery.com)`,
    html,
    attachments,
  });
  if (error) {
    console.error('[forms] Resend error', error);
    return new Response(`Sorry, that did not send. Please email ${EMAIL}.`, { status: 502 });
  }
  return done(request, { ref });
};
