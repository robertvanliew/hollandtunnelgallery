// Form handler (Vercel function). Emails each submission to the gallery inbox via Resend.
// Nothing is published: Paulien reviews claim/update requests and applies them in the CMS.
import type { APIRoute } from 'astro';
import { FORMS_FROM, FORMS_TO, RESEND_API_KEY } from 'astro:env/server';
import { Resend } from 'resend';
import { EMAIL, PUBLIC_SITE } from '../../lib/site';

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
  newsletter: {
    subject: (f: FormData) => `Newsletter signup: ${f.get('email')}`,
    required: ['email'],
    fields: [['Email', 'email']],
  },
} as const;

type FormName = keyof typeof FORMS;
const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (req: Request, path: string) => Response.redirect(new URL(path, req.url), 303);

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

  const body = spec.fields
    .filter(([, key]) => !('skipEmpty' in spec) || text(form, key))
    .map(([label, key]) => `${label}:\n${text(form, key) || '(none)'}`)
    .join('\n\n');

  if (!RESEND_API_KEY) {
    // Private demo without email configured: accept and log so the flow can be tried end to end.
    if (!PUBLIC_SITE) {
      console.warn(`[forms] RESEND_API_KEY not set; ${name} submission not emailed:\n${body}`);
      return back(request, '/thanks');
    }
    return new Response(`Form delivery is not configured yet. Please email ${EMAIL}.`, { status: 503 });
  }

  const { error } = await new Resend(RESEND_API_KEY).emails.send({
    from: FORMS_FROM,
    to: FORMS_TO,
    replyTo: email,
    subject: spec.subject(form),
    text: `${body}\n\n(Sent from the ${name} form on hollandtunnelgallery.com)`,
    attachments,
  });
  if (error) {
    console.error('[forms] Resend error', error);
    return new Response(`Sorry, that did not send. Please email ${EMAIL}.`, { status: 502 });
  }
  return back(request, '/thanks');
};
