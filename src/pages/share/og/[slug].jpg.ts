// 1200×630 link-preview card for each profile, generated at build time.
import type { APIRoute } from 'astro';
import { loadArchive } from '../../../lib/people';
import { ogCard } from '../../../lib/shareCards';

export async function getStaticPaths() {
  const a = await loadArchive();
  return a.people.filter((p) => p.published).map((p) => ({ params: { slug: p.slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const a = await loadArchive();
  const body = await ogCard(a.bySlug.get(params.slug!)!, a);
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/jpeg' } });
};
