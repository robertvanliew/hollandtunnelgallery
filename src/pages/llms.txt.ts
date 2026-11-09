import type { APIRoute } from 'astro';
import { SITE_URL, EMAIL, PHONE } from '../lib/site';
import { onView, longDate } from '../lib/onview';
import { loadArchive } from '../lib/people';

// /llms.txt: a plain-language map of the site for AI assistants (ChatGPT, Claude, Perplexity, Copilot).
// Google says it ignores this file; other assistants may read it. Built from the same data as the pages,
// so "on view now" is always current after each (daily) build. Facts only, nothing promotional.
export const GET: APIRoute = async () => {
  const ov = await onView();
  const a = await loadArchive();
  const shows = [...a.shows.values()].filter((s) => !s.isMusic).length;
  const now =
    ov?.status === 'current'
      ? `On view now: ${ov.show.title}${ov.closes ? `, through ${longDate(ov.closes)}` : ''} (${SITE_URL}${ov.show.url}).`
      : ov?.status === 'upcoming'
        ? `Next exhibition: ${ov.show.title}, opening ${longDate(ov.show.startDate)} (${SITE_URL}${ov.show.url}).`
        : 'The next exhibition will be announced soon.';

  const body = `# Holland Tunnel Gallery

> Holland Tunnel Gallery is a contemporary art gallery, music room and film club at 46 Chambers Street, Newburgh, New York 12550, in the Hudson Valley. It was founded in 1997 by Dutch artist Paulien Lethen in a garden shed in Williamsburg, Brooklyn, which The New York Times called a front-runner for the tiniest gallery in the metropolitan area. It has been in an 1860 warehouse in Newburgh's Historic District since 2018.

## Visit
- Open Saturday and Sunday, 1–5 pm, and by appointment. Admission is free.
- Address: 46 Chambers Street, Newburgh, NY 12550 (between Broadway and First Street).
- ${now}
- Contact: ${EMAIL} · ${PHONE}

## Main pages
- [Home](${SITE_URL}/): what's on, opening hours, map and directions
- [Exhibitions](${SITE_URL}/exhibitions): current, upcoming and past shows (${shows} on record, 2017 to today)
- [Events](${SITE_URL}/events): concerts, performances, poetry and Cinema Club film nights
- [Artists](${SITE_URL}/artists): profiles of artists and musicians who have shown or played at Holland Tunnel
- [Rent the studio](${SITE_URL}/rent): a 900 sq ft second-floor art studio at 46 Chambers Street, by the hour or by the month
- [School visits](${SITE_URL}/schools): field trips and lesson plans for middle and high schools in the Hudson Valley
- [Shop](${SITE_URL}/shop): the Holland Tunnel Gallery book, an artist cookbook, shirts and bags
- [About](${SITE_URL}/about): history from the 1997 Williamsburg garden shed to Paros, Greece and Newburgh
- [Art in Newburgh](${SITE_URL}/art-in-newburgh): visitor guide to galleries, Newburgh Open Studios and nearby art and history
- [Stairmasters](${SITE_URL}/stairmasters): the staircase gallery in Williamsburg (Framed, Delft Blues)

## Key facts
- Founder, director and curator: Paulien Lethen, Dutch artist, born in Utrecht, the Netherlands.
- Locations: Williamsburg, Brooklyn (1997–2019); Parikia, Paros, Greece (since 2000, summers); Newburgh, NY (since 2018).
- The New York Times (Roberta Smith, 1998): "One of the quirkiest spaces in Williamsburg … a front-runner for first place as the tiniest gallery in the metropolitan area."
- Wikipedia: https://en.wikipedia.org/wiki/Holland_Tunnel_Gallery
- Instagram: https://www.instagram.com/hollandtunnelnewburgh/
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
