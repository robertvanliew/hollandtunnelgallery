import { getCollection, type CollectionEntry } from 'astro:content';

export type Status = 'verified' | 'likely' | 'unverified';
export type Group = 'visual' | 'music';
export type ArtistData = CollectionEntry<'artists'>['data'];
export type ShowData = CollectionEntry<'shows'>['data'];

export interface Show extends ShowData {
  id: string;
  url: string;
  isMusic: boolean;
}

export interface Person extends Omit<ArtistData, 'shows'> {
  showIds: string[]; // newest first
  group: Group;
  status: Status;
  published: boolean; // has a profile page
  url: string | null;
}

export const STATUS: Record<Status, { label: string; desc: string }> = {
  verified: { label: 'Verified', desc: 'Identity and facts confirmed against independent sources.' },
  likely: {
    label: 'Pending confirmation',
    desc: 'Researched and sourced; the gallery is confirming a few details with the artist.',
  },
  unverified: { label: 'Not yet confirmed', desc: '' },
};

/** Concerts and performances live under /events, everything else under /exhibitions. */
export const isMusicType = (type: string) => /^(concert|performance)/i.test(type);

const byStart = (a: Show, b: Show) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0);

let cache: Promise<Archive> | null = null;
export const loadArchive = () => (cache ??= build());

export interface Archive {
  people: Person[]; // sorted by surname
  bySlug: Map<string, Person>;
  shows: Map<string, Show>;
  showPeople: Map<string, string[]>; // show id -> person slugs
  findByName: (name: string) => Person | undefined;
}

async function build(): Promise<Archive> {
  const showEntries = await getCollection('shows');
  const shows = new Map<string, Show>();
  for (const e of showEntries) {
    const isMusic = isMusicType(e.data.type);
    shows.set(e.id, { ...e.data, id: e.id, isMusic, url: `/${isMusic ? 'events' : 'exhibitions'}/${e.id}` });
  }

  const artistEntries = await getCollection('artists');
  const people: Person[] = artistEntries.map(({ data }) => {
    const { shows: refs, ...rest } = data;
    const showIds = refs.map((r) => r.id).sort((a, b) => byStart(shows.get(a)!, shows.get(b)!));
    const status = data.verification.status as Status;
    const published = status !== 'unverified';
    return {
      ...rest,
      showIds,
      status,
      published,
      group: data.kind === 'musician' || data.kind === 'performer' ? 'music' : 'visual',
      url: published ? `/artists/${data.slug}` : null,
    };
  });
  people.sort((a, b) => surname(a.name).localeCompare(surname(b.name)) || a.name.localeCompare(b.name));

  const bySlug = new Map(people.map((p) => [p.slug, p]));
  const byName = new Map(people.map((p) => [p.name, p]));
  const showPeople = new Map<string, string[]>();
  for (const p of people) for (const s of p.showIds) showPeople.set(s, [...(showPeople.get(s) ?? []), p.slug]);

  // Collaborator names in the research are free text: exact match first, then same first + last name
  // (so "Jeffrey Benjamin" finds "Jeffrey L. Benjamin").
  const findByName = (name: string) => {
    if (byName.has(name)) return byName.get(name);
    const w = name.trim().split(/\s+/);
    if (w.length < 2) return undefined;
    return people.find((q) => {
      const v = q.name.split(/\s+/);
      return v[0] === w[0] && v[v.length - 1] === w[w.length - 1];
    });
  };

  return { people, bySlug, shows, showPeople, findByName };
}

export const surname = (name: string) => name.trim().split(/\s+/).pop()!.toLowerCase();

export function initials(name: string) {
  const parts = name.split(/[\s.]+/).filter((w) => w && /\p{L}/u.test(w[0]));
  return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function rolesLine(p: Pick<Person, 'roles' | 'kind'>) {
  const r = p.roles.filter(Boolean).map(cap);
  return r.length ? r.slice(0, 4).join(' · ') : cap(p.kind);
}

export function lifeYears(p: Pick<Person, 'born' | 'died'>) {
  if (p.born && p.died) return `${p.born}–${p.died}`;
  if (p.born) return `b. ${p.born}`;
  if (p.died) return `d. ${p.died}`;
  return '';
}

export const htgYears = (p: Person, a: Archive) => [...new Set(p.showIds.map((s) => a.shows.get(s)!.year))].sort();

/** Profile hero image: the artist's own image, else the newest of their shows that has one. */
export function heroImage(p: Person, a: Archive) {
  if (p.image) return { src: p.image, alt: p.imageAlt! };
  for (const id of p.showIds) {
    const s = a.shows.get(id)!;
    if (s.image) return { src: s.image, alt: s.imageAlt! };
  }
  return null;
}

export interface Connections {
  shared: [string, string[]][]; // [slug, show ids], most shared first
  circle: { slug: string | null; name: string; relation: string }[];
}

export function connections(p: Person, a: Archive): Connections {
  const shared = new Map<string, string[]>();
  for (const s of p.showIds)
    for (const o of a.showPeople.get(s) ?? []) if (o !== p.slug) shared.set(o, [...(shared.get(o) ?? []), s]);
  const sortedShared = [...shared.entries()].sort(
    (x, y) => y[1].length - x[1].length || a.bySlug.get(x[0])!.name.localeCompare(a.bySlug.get(y[0])!.name),
  );
  const circle = p.collaborators_and_connections
    .filter((c) => c.name)
    .map((c) => {
      const other = a.findByName(c.name);
      return { slug: other && other.slug !== p.slug ? other.slug : null, name: c.name, relation: c.relation };
    });
  return { shared: sortedShared, circle };
}

export interface WheelNode {
  slug: string;
  kind: 'show' | 'circle';
  label: string;
}

/** Co-exhibitors first, then directory members from the wider circle. Max 16. */
export function wheelNodes(p: Person, a: Archive, c = connections(p, a)): WheelNode[] {
  const nodes: WheelNode[] = [];
  const seen = new Set<string>();
  for (const [slug, ids] of c.shared) {
    nodes.push({ slug, kind: 'show', label: 'Shown together: ' + ids.map((s) => a.shows.get(s)!.title).join(', ') });
    seen.add(slug);
  }
  for (const x of c.circle)
    if (x.slug && !seen.has(x.slug)) {
      nodes.push({ slug: x.slug, kind: 'circle', label: x.relation });
      seen.add(x.slug);
    }
  return nodes.slice(0, 16);
}

/** Edges of the Holland Tunnel web: one per pair of people who share at least one show. */
export function networkEdges(a: Archive) {
  const edges: { a: string; b: string; w: number }[] = [];
  const ps = a.people;
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const s = new Set(ps[i].showIds);
      const w = ps[j].showIds.filter((x) => s.has(x)).length;
      if (w) edges.push({ a: ps[i].slug, b: ps[j].slug, w });
    }
  return edges;
}

const LINK_LABELS = {
  website: 'Official website',
  instagram: 'Instagram',
  wikipedia: 'Wikipedia',
  wikidata: 'Wikidata',
  bandcamp: 'Bandcamp',
  spotify: 'Spotify',
  youtube: 'YouTube',
} as const;

export function linkItems(p: Person) {
  const out: { label: string; url: string }[] = [];
  for (const k of Object.keys(LINK_LABELS) as (keyof typeof LINK_LABELS)[])
    if (p.links[k]) out.push({ label: LINK_LABELS[k], url: p.links[k] });
  for (const u of p.links.other ?? []) if (u) out.push({ label: hostOf(u), url: u });
  return out;
}

export const hostOf = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

/** Verification sources plus press with URLs, deduplicated. */
export function sourceList(p: Person) {
  const out: { url: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const u of p.verification.sources)
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push({ url: u, text: u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80) });
    }
  for (const pr of p.press)
    if (pr.url && !seen.has(pr.url)) {
      seen.add(pr.url);
      out.push({ url: pr.url, text: `${pr.outlet}${pr.year ? ', ' + pr.year : ''}: ${pr.title}` });
    }
  return out;
}

/** Split a single very long bio into ~3 readable paragraphs at sentence boundaries. */
export function bioParagraphs(text: string) {
  let paras = text
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (paras.length === 1 && paras[0].split(/\s+/).length > 120) {
    const sents = paras[0].split(/(?<=[.!?])\s+(?=[A-Z])/);
    const n = Math.max(2, Math.round(sents.length / 3));
    const size = Math.ceil(sents.length / n);
    paras = [];
    for (let i = 0; i < sents.length; i += size) paras.push(sents.slice(i, i + size).join(' '));
  }
  return paras;
}

export function truncate(s: string, max = 158) {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '…';
}
