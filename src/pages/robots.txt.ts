import type { APIRoute } from 'astro';
import { PUBLIC_SITE, SITE_URL } from '../lib/site';

// Private demo: block everything. Public: allow all crawlers, including AI assistants
// (see project brief §6 step 10), and point to the sitemap.
export const GET: APIRoute = () =>
  new Response(
    PUBLIC_SITE
      ? `User-agent: *\nAllow: /\nDisallow: /artists/claim/\nDisallow: /thanks\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`
      : 'User-agent: *\nDisallow: /\n',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
