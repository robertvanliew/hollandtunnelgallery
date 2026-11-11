// Build-time share images for each profile, in the gallery's fonts and colors:
//   og    1200×630  link previews (Facebook, X, LinkedIn, WhatsApp, iMessage, Slack…)
//   story 1080×1920 Instagram / Facebook Stories (shared as an image file via the share sheet)
// satori lays the card out and draws text as vector paths (no system fonts needed); sharp encodes JPEG.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';
import { heroImage, htgYears, initials, rolesLine, type Archive, type Person } from './people';

const require = createRequire(import.meta.url);
const C = { orange: '#E75D18', orangeLight: '#F16F1E', ink: '#111111', text: '#474343', muted: '#7C6E6E', paper: '#FAF8F6', white: '#FFFFFF' };

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 600; style: 'normal' }[]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all([
    ['Bebas', '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff', 400],
    ['Montserrat', '@fontsource/montserrat/files/montserrat-latin-500-normal.woff', 500],
    ['Montserrat', '@fontsource/montserrat/files/montserrat-latin-600-normal.woff', 600],
  ].map(async ([name, file, weight]) => ({
    name: name as string,
    data: await fs.readFile(require.resolve(file as string)),
    weight: weight as 400 | 500 | 600,
    style: 'normal' as const,
  }))));

// Minimal element factory for satori (no JSX needed).
type El = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (El | string | null | false)[]): El => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter(Boolean) },
});
const img = (src: string, w: number, hgt: number): El => ({
  type: 'img',
  props: { src, width: w, height: hgt, style: { width: w, height: hgt, objectFit: 'cover' } },
});

async function photo(p: Person, a: Archive, w: number, hgt: number) {
  const hero = heroImage(p, a);
  const fsPath = hero && (hero.src as unknown as { fsPath?: string }).fsPath;
  if (!fsPath) return null;
  const scale = Math.min(1.5, 1400 / Math.max(w, hgt)); // a little oversampling, kept small for speed
  // Screenshot frames are already removed from the source files (scripts/trim-screenshot-frames.mjs).
  const buf = await sharp(fsPath)
    .rotate()
    .resize(Math.round(w * scale), Math.round(hgt * scale), { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

/** Name size that fits `width` in Bebas (≈0.42em per glyph), capped at `max`, over up to 2 lines. */
const nameSize = (name: string, width: number, max: number) => {
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length));
  const oneLine = width / (name.length * 0.42);
  const twoLines = width / (Math.max(longest, Math.ceil(name.length / 2)) * 0.42);
  return Math.round(Math.min(max, Math.max(oneLine, Math.min(twoLines, max * 0.8))));
};

const monoTile = (p: Person, w: number, hgt: number, size: number) =>
  h('div', { width: w, height: hgt, background: p.group === 'music' ? C.ink : C.orange, alignItems: 'center', justifyContent: 'center', fontFamily: 'Bebas', fontSize: size, color: p.group === 'music' ? C.orangeLight : C.white }, initials(p.name));

const urlText = (p: Person) => `hollandtunnelgallery.com${p.url}`;
/** Largest size (≤ max) at which the URL fits `width` on one line; ≈0.6em per glyph for Montserrat 600. */
const urlSize = (p: Person, width: number, max: number) => Math.floor(Math.min(max, width / (urlText(p).length * 0.6)));

async function render(tree: El, width: number, height: number) {
  const svg = await satori(tree as never, { width, height, fonts: await loadFonts() });
  return sharp(Buffer.from(svg)).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer();
}

export async function ogCard(p: Person, a: Archive) {
  const pic = await photo(p, a, 520, 630);
  const years = htgYears(p, a);
  const textW = pic ? 600 : 1080;
  const left = h('div', { flexDirection: 'column', justifyContent: 'space-between', width: 1200 - 520, height: 630, padding: '52px 56px 46px' },
    h('div', { flexDirection: 'column' },
      h('div', { fontFamily: 'Bebas', fontSize: 34, letterSpacing: 7, color: C.orange }, 'Holland Tunnel Gallery'),
      h('div', { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 17, letterSpacing: 3, color: C.ink, marginTop: 6, alignItems: 'center' },
        h('div', { width: 26, height: 4, background: C.orange, marginRight: 12 }), p.group === 'music' ? 'MUSICIAN & PERFORMER' : 'ARTIST')),
    h('div', { flexDirection: 'column' },
      h('div', { fontFamily: 'Bebas', fontSize: nameSize(p.name, textW, 132), lineHeight: 0.9, color: C.orange }, p.name),
      h('div', { fontFamily: 'Bebas', fontSize: 30, letterSpacing: 2, color: C.ink, marginTop: 14 }, rolesLine(p).split(' · ').slice(0, 3).join(' · ')),
      years.length > 0 && h('div', { fontFamily: 'Montserrat', fontWeight: 500, fontSize: 21, color: C.muted, marginTop: 8 }, `Holland Tunnel ${years.join(' · ')}`)),
    h('div', { fontFamily: 'Montserrat', fontWeight: 600, fontSize: urlSize(p, 560, 19), color: C.ink, borderTop: `2px solid ${C.ink}`, paddingTop: 14, whiteSpace: 'nowrap' }, urlText(p)));
  const right = pic ? img(pic, 520, 630) : monoTile(p, 520, 630, 300);
  return render(h('div', { width: 1200, height: 630, background: C.white, flexDirection: 'row' }, left, right), 1200, 630);
}

export async function storyCard(p: Person, a: Archive) {
  const pic = await photo(p, a, 920, 920);
  const years = htgYears(p, a);
  const tree = h('div', { width: 1080, height: 1920, background: C.white, flexDirection: 'column', alignItems: 'center' },
    h('div', { flexDirection: 'column', alignItems: 'center', marginTop: 110 },
      h('div', { fontFamily: 'Bebas', fontSize: 64, letterSpacing: 16, color: C.orange }, 'Holland Tunnel Gallery'),
      h('div', { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 24, letterSpacing: 4, color: C.muted, marginTop: 6 }, 'NEWBURGH, NY · SINCE 1997')),
    h('div', { marginTop: 56, border: `2px solid ${C.ink}` }, pic ? img(pic, 920, 920) : monoTile(p, 920, 920, 420)),
    h('div', { flexDirection: 'column', alignItems: 'center', width: 920, marginTop: 44 },
      h('div', { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 24, letterSpacing: 4, color: C.ink, alignItems: 'center' },
        h('div', { width: 30, height: 4, background: C.orange, marginRight: 14 }),
        `${p.group === 'music' ? 'MUSICIAN & PERFORMER' : 'ARTIST'}${years.length ? ` · ${years.join(' · ')}` : ''}`),
      h('div', { fontFamily: 'Bebas', fontSize: nameSize(p.name, 920, 170), lineHeight: 0.9, color: C.orange, marginTop: 18, textAlign: 'center', justifyContent: 'center' }, p.name),
      h('div', { fontFamily: 'Bebas', fontSize: 40, letterSpacing: 2, color: C.ink, marginTop: 14, textAlign: 'center', justifyContent: 'center' }, rolesLine(p).split(' · ').slice(0, 3).join(' · '))),
    h('div', { position: 'absolute', bottom: 0, left: 0, width: 1080, height: 200, background: C.ink, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
      h('div', { fontFamily: 'Montserrat', fontWeight: 500, fontSize: 26, color: '#D9D5D2' }, 'Artists & Musicians · 46 Chambers Street, Newburgh'),
      h('div', { fontFamily: 'Montserrat', fontWeight: 600, fontSize: urlSize(p, 960, 36), color: C.orangeLight, marginTop: 10, whiteSpace: 'nowrap' }, urlText(p))));
  return render(tree, 1080, 1920);
}

// ---- Site pages: one branded link-preview card per main page --------------------------------------
// Ink panel with the HTG monogram, the gallery name, the page's title and the address, beside a real
// photo of that part of the gallery. Replaces the generic default image so every shared link (iMessage,
// WhatsApp, Facebook, LinkedIn, Slack) is clearly Holland Tunnel.

const MARK = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 200" fill="none"><path d="M26 26 V184 M26 108 H118 M118 26 V184" stroke="#FFFFFF" stroke-width="28"/><path d="M76 26 H248 A76 76 0 1 0 324 108 H262" stroke="#E75D18" stroke-width="28"/></svg>',
).toString('base64')}`;

export interface SiteCard {
  /** Big line, e.g. "Art, music & film" or "Studio for rent". */
  title: string;
  /** One short line under the title. */
  sub: string;
  /** Source photo on disk (repo-relative), cropped to fill the right side. */
  photo: string;
}

export const SITE_CARDS: Record<string, SiteCard> = {
  home: { title: 'Art, music & film', sub: 'Open Saturday & Sunday, 1–5 pm · Free', photo: 'src/assets/home/46-chambers-street-front.jpg' },
  about: { title: 'Since 1997', sub: 'From a Brooklyn garden shed to Newburgh', photo: 'src/assets/home/46-chambers-street-hallway.jpg' },
  exhibitions: { title: 'Exhibitions', sub: 'New shows by Hudson Valley & international artists', photo: 'src/assets/shows/alone-together-2026-0272.jpg' },
  events: { title: 'Music & events', sub: 'Concerts, performance & Cinema Club', photo: 'src/assets/shows/alone-together-2026-0466.jpg' },
  artists: { title: 'Artists & musicians', sub: 'Who has shown and played at Holland Tunnel', photo: 'src/assets/shows/alone-together-2026-0463.jpg' },
  schools: { title: 'School visits', sub: 'Field trips for grades 6–12', photo: 'src/assets/home/46-chambers-street-main-room.jpg' },
  shop: { title: 'Shop', sub: 'The Holland Tunnel book, cookbook & tote bags', photo: 'src/assets/shop/holland-tunnel-gallery-book-3.jpg' },
  rent: { title: 'Studio for rent', sub: '900 sq ft · by the hour or by the month', photo: 'src/assets/rent/room-windows.jpg' },
  'art-in-newburgh': { title: 'Art in Newburgh', sub: "A visitor's guide to galleries & a day out", photo: 'src/assets/home/46-chambers-street-doors.jpg' },
  stairmasters: { title: 'Stairmasters', sub: 'The staircase gallery, Williamsburg, from 2003', photo: 'src/assets/history/stairmasters-framed.jpg' },
};

export async function siteCard(key: string) {
  const c = SITE_CARDS[key];
  const W = 1200, H = 630, PW = 500;
  // Builds run from the project root, so repo-relative photo paths resolve from process.cwd().
  const buf = await sharp(path.join(process.cwd(), c.photo))
    .rotate()
    .resize(PW * 2, H * 2, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 86 })
    .toBuffer();
  const pic = `data:image/jpeg;base64,${buf.toString('base64')}`;
  const titleSize = Math.min(118, Math.floor((W - PW - 112) / (c.title.length * 0.42)));
  const panel = h('div', { flexDirection: 'column', justifyContent: 'space-between', width: W - PW, height: H, padding: '50px 56px 44px', background: C.ink },
    h('div', { alignItems: 'center' },
      { type: 'img', props: { src: MARK, width: 102, height: 60, style: { width: 102, height: 60 } } },
      h('div', { fontFamily: 'Bebas', fontSize: 40, letterSpacing: 6, color: C.orange, marginLeft: 22, marginTop: 6 }, 'Holland Tunnel Gallery')),
    h('div', { flexDirection: 'column' },
      h('div', { width: 54, height: 5, background: C.orange, marginBottom: 22 }),
      h('div', { fontFamily: 'Bebas', fontSize: titleSize, lineHeight: 0.92, color: C.white }, c.title),
      h('div', { fontFamily: 'Montserrat', fontWeight: 500, fontSize: 24, lineHeight: 1.35, color: '#D9D5D2', marginTop: 16, maxWidth: W - PW - 112 }, c.sub)),
    h('div', { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 19, letterSpacing: 1, color: '#BDB5B1', borderTop: '2px solid #3A3636', paddingTop: 16 },
      '46 Chambers Street, Newburgh, NY · Since 1997'));
  return render(h('div', { width: W, height: H, flexDirection: 'row' }, panel, img(pic, PW, H)), W, H);
}
