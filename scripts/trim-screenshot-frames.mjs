// One-off: remove the thin white "screenshot frame" (white border + faint gray shadow line) that some
// images from the old Squarespace site have. Only crops when the edge is near-white and the border is
// thin on all four sides, so photos, paintings and objects shot on white are left alone.
// Rewrites files in place under src/assets/; safe to re-run (already-trimmed files are skipped).
// Run: node scripts/trim-screenshot-frames.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const dirs = ['src/assets/artists', 'src/assets/shows'];

async function detectFrame(file) {
  const { data, info } = await sharp(file).rotate().greyscale().resize({ width: 400 }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  // A screenshot frame is near-white at the very edge (measured 244–255); real photos and paintings
  // are much darker there (≤ 185), so they're never cropped.
  let edge = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) { edge += data[y * W + x]; n++; }
  if (edge / n < 235) return null;
  const dark = (x, y) => data[y * W + x] < 170;
  const rowDark = (y) => { let n = 0; for (let x = 0; x < W; x++) n += dark(x, y); return n / W > 0.3; };
  const colDark = (x) => { let n = 0; for (let y = 0; y < H; y++) n += dark(x, y); return n / H > 0.3; };
  let top = 0, bottom = H - 1, left = 0, right = W - 1;
  while (top < H / 4 && !rowDark(top)) top++;
  while (bottom > (H * 3) / 4 && !rowDark(bottom)) bottom--;
  while (left < W / 4 && !colDark(left)) left++;
  while (right > (W * 3) / 4 && !colDark(right)) right--;
  if (top + left + (H - 1 - bottom) + (W - 1 - right) === 0) return null;
  const thin = top < H * 0.08 && left < W * 0.08 && H - 1 - bottom < H * 0.08 && W - 1 - right < W * 0.08;
  if (!thin) return null;
  const meta = await sharp(file).rotate().metadata();
  const fullW = meta.autoOrient?.width ?? meta.width, fullH = meta.autoOrient?.height ?? meta.height;
  const k = fullW / W, inset = 3;
  const l = Math.round((left + inset) * k), t = Math.round((top + inset) * k);
  return { left: l, top: t, width: Math.min(fullW - l, Math.round((right - left - 2 * inset) * k)), height: Math.min(fullH - t, Math.round((bottom - top - 2 * inset) * k)), fullW, fullH };
}

for (const dir of dirs)
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const box = await detectFrame(file);
    if (!box) continue;
    const { fullW, fullH, ...crop } = box;
    const out = await sharp(file).rotate().extract(crop).toBuffer();
    fs.writeFileSync(file, out);
    console.log(`trimmed ${file}: ${fullW}×${fullH} -> ${crop.width}×${crop.height}`);
  }
