// Build-time share images for each profile, in the gallery's fonts and colors:
//   og    1200×630  link previews (Facebook, X, LinkedIn, WhatsApp, iMessage, Slack…)
//   story 1080×1920 Instagram / Facebook Stories (shared as an image file via the share sheet)
// satori lays the card out and draws text as vector paths (no system fonts needed); sharp encodes JPEG.
import fs from 'node:fs/promises';
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
