import type { APIRoute } from 'astro';
import { PUBLIC_SITE, SITE_URL } from '../lib/site';

// Private demo: block everything. Public: allow all crawlers, including AI assistants
// (see project brief §6 step 10), and point to the sitemap. Claim forms and /thanks are not disallowed:
// they carry noindex, and Google has to fetch a page to see its noindex. A robots.txt block would let the
// URLs be indexed anyway, without a snippet, because every profile links to its claim form.
export const GET: APIRoute = () =>
  new Response(
    PUBLIC_SITE
      ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`
      : 'User-agent: *\nDisallow: /\n',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
