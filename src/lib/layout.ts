// Build-time geometry for the two SVG graphics. Running the layout at build time means the page
// ships finished SVG (fast, works without JS); client JS only adds highlighting.

export interface WebNode { id: string; name: string; g: 'visual' | 'music'; pending: boolean }
export interface WebEdge { a: string; b: string; w: number }

export const WEB_W = 1100;
export const WEB_H = 640;

/** Force-directed layout (same model as the approved prototype), deterministic. */
export function layoutWeb(nodes: WebNode[], edges: WebEdge[]) {
  const W = WEB_W, H = WEB_H, n = nodes.length;
  const N = nodes.map((node, i) => ({
    ...node,
    x: W / 2 + Math.cos(i * 2.4) * 260 * Math.sqrt((i + 1) / n),
    y: H / 2 + Math.sin(i * 2.4) * 230 * Math.sqrt((i + 1) / n),
    vx: 0,
    vy: 0,
  }));
  const idx = new Map(N.map((x, i) => [x.id, i]));
  const E = edges.map((e) => ({ a: idx.get(e.a)!, b: idx.get(e.b)!, w: e.w }));
  const deg = N.map(() => 0);
  E.forEach((e) => { deg[e.a] += e.w; deg[e.b] += e.w; });
  const IT = 420;
  for (let it = 0; it < IT; it++) {
    const k = 1 - it / IT;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = N[j].x - N[i].x, dy = N[j].y - N[i].y, d2 = dx * dx + dy * dy + 0.01, f = 5200 / d2, d = Math.sqrt(d2);
        N[i].vx -= (f * dx) / d; N[i].vy -= (f * dy) / d; N[j].vx += (f * dx) / d; N[j].vy += (f * dy) / d;
      }
    for (const e of E) {
      const A = N[e.a], B = N[e.b];
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - 95) * 0.01 * Math.min(e.w, 2);
      A.vx += (f * dx) / d; A.vy += (f * dy) / d; B.vx -= (f * dx) / d; B.vy -= (f * dy) / d;
    }
    for (const p of N) {
      p.vx += (W / 2 - p.x) * 0.004; p.vy += (H / 2 - p.y) * 0.005;
      p.x += p.vx * k * 0.5; p.y += p.vy * k * 0.5; p.vx *= 0.6; p.vy *= 0.6;
      p.x = Math.max(40, Math.min(W - 40, p.x)); p.y = Math.max(30, Math.min(H - 30, p.y));
    }
  }
  // fit to the frame
  const xs = N.map((p) => p.x), ys = N.map((p) => p.y), P = 70;
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (W - 2 * P) / Math.max(1, x1 - x0), sy = (H - 2 * P) / Math.max(1, y1 - y0);
  const top = new Set([...N.keys()].sort((a, b) => deg[b] - deg[a]).slice(0, 10));
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    nodes: N.map((p, i) => ({
      id: p.id, name: p.name, g: p.g, pending: p.pending,
      x: r1(P + (p.x - x0) * sx), y: r1(P + (p.y - y0) * sy),
      r: r1(5 + Math.min(deg[i], 18) * 0.55), big: top.has(i), i,
    })),
    edges: E.map((e) => ({ ...e, width: r1(0.6 + e.w * 0.7) })),
  };
}

/** Rough text width for Montserrat 500 (≈0.6em per glyph); good enough to keep labels inside the frame. */
const textW = (s: string, px: number) => s.length * px * 0.6;

/** Radial "connections wheel". Computes a viewBox that contains every label, so nothing clips. */
export function layoutWheel(names: string[], fontPx = 15) {
  const n = names.length;
  const cx = 0, cy = 0;
  const r = n > 6 ? 180 : 150;
  const stretch = 1.25;
  const pts = names.map((name, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const x = cx + r * Math.cos(a) * stretch, y = cy + r * Math.sin(a);
    const c = Math.cos(a), s = Math.sin(a);
    const anchor = c > 0.25 ? 'start' : c < -0.25 ? 'end' : 'middle';
    const dx = anchor === 'start' ? 18 : anchor === 'end' ? -18 : 0;
    const dy = anchor !== 'middle' ? 5 : s > 0 ? 32 : -22;
    const tx = x + dx, ty = y + dy, w = textW(name, fontPx);
    const lx = anchor === 'start' ? tx : anchor === 'end' ? tx - w : tx - w / 2;
    return { x, y, tx, ty, anchor, box: [lx, ty - fontPx, lx + w, ty + 5] as const };
  });
  const pad = 24;
  const minX = Math.min(-60, ...pts.map((p) => p.box[0])) - pad;
  const maxX = Math.max(60, ...pts.map((p) => p.box[2])) + pad;
  const minY = Math.min(-60, ...pts.map((p) => p.box[1])) - pad;
  const maxY = Math.max(60, ...pts.map((p) => p.box[3])) + pad;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    viewBox: `${r1(minX)} ${r1(minY)} ${r1(maxX - minX)} ${r1(maxY - minY)}`,
    cx, cy,
    pts: pts.map((p) => ({ x: r1(p.x), y: r1(p.y), tx: r1(p.tx), ty: r1(p.ty), anchor: p.anchor })),
  };
}
