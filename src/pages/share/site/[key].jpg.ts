// 1200×630 branded link-preview card for each main page (see SITE_CARDS), generated at build time.
import type { APIRoute } from 'astro';
import { SITE_CARDS, siteCard } from '../../../lib/shareCards';

export const getStaticPaths = () => Object.keys(SITE_CARDS).map((key) => ({ params: { key } }));

export const GET: APIRoute = async ({ params }) =>
  new Response(new Uint8Array(await siteCard(params.key!)), { headers: { 'Content-Type': 'image/jpeg' } });
