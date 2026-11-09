import { ADDRESS, GALLERY, LAST_REVIEWED, SITE_URL } from './site';
import { linkItems, type Archive, type Person, type Show } from './people';
import { filmEmbed } from './film';

const abs = (path: string) => new URL(path, SITE_URL).href;

/** A YYYY-MM-DD date as a full ISO 8601 datetime at noon in New York (Google's ProfilePage and
 *  VideoObject dates must include a time and time zone, or Search Console flags "invalid datetime"). */
export function nyDateTime(date: string) {
  const noonUtc = new Date(`${date}T16:00:00Z`);
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
    .formatToParts(noonUtc).find((x) => x.type === 'timeZoneName')!.value; // e.g. "GMT-4"
  const h = Number(tz.replace('GMT', '')) || 0;
  return `${date}T12:00:00${h < 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:00`;
}

const LOCATION = { '@type': 'ArtGallery', name: 'Holland Tunnel Gallery', address: ADDRESS } as const;
const ORGANIZER = { '@type': 'ArtGallery', name: 'Holland Tunnel Gallery', url: `${SITE_URL}/` } as const;

/** Event photo when a page doesn't pass the show's own image: the gallery interior. */
const FALLBACK_EVENT_IMAGE = '/img/gallery-installation-view-1.webp';

/** A show as ExhibitionEvent, or MusicEvent for concerts and performances.
 *  Google's Event rich results recommend endDate, image and offers on every event (Search Console flags
 *  them as missing otherwise), so all three are always present: one-day events end the day they start,
 *  and entry is free (concerts ask only a suggested donation at the door). */
export function eventNode(s: Show, opts: { image?: string; performers?: Person[] } = {}) {
  const node: Record<string, unknown> = {
    '@type': s.isMusic ? 'MusicEvent' : 'ExhibitionEvent',
    '@id': `${abs(s.url)}#event`,
    name: s.title,
    url: abs(s.url),
    description: s.description ?? `${s.type} at Holland Tunnel Gallery (${s.venue}), ${s.dates}.`,
    startDate: s.startDate,
    endDate: s.endDate ?? s.startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: LOCATION,
    organizer: ORGANIZER,
    image: [abs(opts.image ?? FALLBACK_EVENT_IMAGE)],
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: abs(s.url),
      validFrom: s.startDate,
    },
  };
  // Performers: linked profiles first, then everyone else the show names (Google recommends a performer
  // on every event; for exhibitions these are the exhibiting artists). Never guessed: only listed names.
  const linked = (opts.performers ?? []).map((p) => ({
    '@type': 'Person',
    name: p.name,
    ...(p.url ? { url: abs(p.url), '@id': `${abs(p.url)}#person` } : {}),
  }));
  const named = (s.artists ?? [])
    .filter((n) => !linked.some((p) => p.name === n))
    .map((name) => ({ '@type': 'Person', name }));
  if (linked.length || named.length) node.performer = [...linked, ...named];
  return node;
}

export function profileGraph(p: Person, a: Archive, imageUrl?: string, filmThumb?: string) {
  const url = abs(p.url!);
  const personId = `${url}#person`;
  const sameAs = linkItems(p).map((l) => l.url).filter((u) => u.startsWith('http'));
  const events = p.showIds.map((id) => a.shows.get(id)!);
  const music = events.filter((s) => s.isMusic).map((s) => eventNode(s, { performers: [p] }));
  const exhibitions = events.filter((s) => !s.isMusic).map((s) => eventNode(s, { performers: [p] }));
  const person: Record<string, unknown> = {
    '@type': 'Person',
    '@id': personId,
    name: p.name,
    url,
    description: p.bio_short,
    jobTitle: p.roles.slice(0, 3).join(', ') || undefined,
    alternateName: p.also_known_as.length ? p.also_known_as : undefined,
    birthDate: p.born || undefined,
    deathDate: p.died || undefined,
    alumniOf: p.education.filter((e) => e.school).map((e) => ({ '@type': 'EducationalOrganization', name: e.school })),
    image: imageUrl ? abs(imageUrl) : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    performerIn: music.length ? music : undefined,
    subjectOf: exhibitions.length ? exhibitions : undefined,
  };
  for (const k of Object.keys(person)) {
    const v = person[k];
    if (v === undefined || (Array.isArray(v) && v.length === 0)) delete person[k];
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': url,
        url,
        name: `${p.name} · Holland Tunnel Gallery`,
        dateModified: nyDateTime(LAST_REVIEWED),
        mainEntity: { '@id': personId },
        isPartOf: { '@type': 'WebSite', name: 'Holland Tunnel Gallery', url: `${SITE_URL}/` },
      },
      person,
      ...(p.video && filmThumb
        ? [{
            '@type': 'VideoObject',
            '@id': `${url}#film`,
            name: p.video.title,
            description: p.video.description || `A short film about ${p.name}, made for Holland Tunnel Gallery.`,
            thumbnailUrl: [abs(filmThumb)],
            uploadDate: nyDateTime(p.video.uploadDate),
            ...(p.video.duration ? { duration: p.video.duration } : {}),
            ...(filmEmbed(p.video.url) ? { embedUrl: filmEmbed(p.video.url)!.src.split('?')[0] } : { contentUrl: abs(p.video.url) }),
            about: { '@id': personId },
            publisher: { '@type': 'ArtGallery', name: 'Holland Tunnel Gallery', url: `${SITE_URL}/` },
          }]
        : []),
      breadcrumbs([
        ['Home', '/'],
        ['Artists & Musicians', '/artists'],
        [p.name, p.url!],
      ]),
    ],
  };
}

export function breadcrumbs(items: [string, string][]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(path) })),
  };
}

export function directoryGraph(published: Person[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': abs('/artists'),
        url: abs('/artists'),
        name: 'Artists & Musicians · Holland Tunnel Gallery',
        description:
          'Profiles of the artists and musicians who have shown and performed at Holland Tunnel Gallery since 1997.',
        about: {
          ...GALLERY,
          foundingDate: '1997',
          founder: { '@type': 'Person', name: 'Paulien Lethen', url: abs('/artists/paulien-lethen') },
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: published.length,
          itemListElement: published.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(p.url!), name: p.name })),
        },
      },
      breadcrumbs([
        ['Home', '/'],
        ['Artists & Musicians', '/artists'],
      ]),
    ],
  };
}
