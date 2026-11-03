// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import fs from 'node:fs';

const SITE = 'https://www.hollandtunnelgallery.com';

// Only `verified` artist profiles go in the sitemap; `likely` ones stay out (and are noindex)
// until the gallery confirms them. Driven by verification.status in src/content/artists.
const artistDir = new URL('./src/content/artists/', import.meta.url);
const notVerified = new Set(
  fs
    .readdirSync(artistDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(new URL(f, artistDir), 'utf8')))
    .filter((a) => a.verification?.status !== 'verified')
    .map((a) => `${SITE}/artists/${a.slug}`),
);

/** Old Squarespace URLs -> new pages, as permanent (301) redirects (project brief §6, step 7). */
const moved = (/** @type {string} */ destination) => ({ status: /** @type {301} */ (301), destination });

export default defineConfig({
  site: SITE,
  trailingSlash: 'never',
  // Pages are prerendered (static). Only src/pages/api/forms.ts runs on demand, as a Vercel function.
  adapter: vercel(),
  env: {
    schema: {
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      FORMS_TO: envField.string({ context: 'server', access: 'secret', default: 'info@hollandtunnelgallery.com' }),
      FORMS_FROM: envField.string({
        context: 'server',
        access: 'secret',
        default: 'Holland Tunnel Gallery <forms@hollandtunnelgallery.com>',
      }),
    },
  },
  redirects: {
    '/htgartists': moved('/artists'),
    '/htrevisisted': moved('/exhibitions'),
    '/rental': moved('/rent'),
    '/events-1': moved('/events'),
    '/contact': moved('/#visit'),
    '/home': moved('/'),
    '/new-page-1': moved('/'),
    '/newburgh': moved('/about'),
    '/williamsburg': moved('/about'),
    '/paros': moved('/about'),
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !notVerified.has(page.replace(/\/$/, '')) && !page.includes('/artists/claim/') && !page.endsWith('/thanks'),
    }),
  ],
});
