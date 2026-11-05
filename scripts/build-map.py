"""Build the home page's painted neighborhood map (src/assets/map/gallery-map.svg).

Source: U.S. Census Bureau TIGER/Line 2024 roads and area water for Orange County, NY (FIPS 36071).
TIGER/Line is a U.S. government work in the public domain, so the map needs no credit line
(unlike OpenStreetMap-based maps). The output is a static SVG centered on the gallery, drawn in the
site's painted style: grass-green land, blue streets with paper edges, uppercase street names.

Usage (run from the project root; needs only the Python standard library):
    python scripts/build-map.py                 # downloads the two TIGER files to a temp folder
    python scripts/build-map.py --tiger <dir>   # or use already-unzipped TIGER files

Re-run it only if the map's center, extent or style changes; the SVG is committed.
"""
import argparse
import math
import os
import struct
import tempfile
import urllib.request
import zipfile

# --- what to draw -------------------------------------------------------------------------------
CENTER = (41.50177, -74.01141)  # 46 Chambers Street, Newburgh, NY 12550
W, H = 1000, 560                # SVG units; the page shows it with "slice", always centered
SPAN_LON = 0.0125               # about 1 km east-west
COUNTY = "36071"
TIGER = "https://www2.census.gov/geo/tiger/TIGER2024"
EXTENT = 1.0                    # a fixed view (no pan/zoom: visitors use Google or Apple Maps to explore)
GALLERY_STREET = "CHAMBERS ST"  # always labeled, right beside the pin
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "map", "gallery-map.svg")

COL = {"grass": "#9DC47E", "water": "#2E5E9E", "major": "#2A55B5", "street": "#3F72D6",
       "service": "#5C86DA", "edge": "#F7F2E8"}
# MTFCC road classes -> drawing tier (line width, edge width)
TIER = {"major": (12, 20), "street": (8, 14), "service": (4, 8)}
MTFCC = {"S1100": "major", "S1200": "major", "S1400": "street", "S1630": "street",
         "S1640": "service", "S1730": "service", "S1740": "service", "S1780": "service"}
LABEL_SIZE = {"major": 19, "street": 17}


# --- minimal shapefile + dbf readers (polyline and polygon only) ---------------------------------
def read_dbf(path):
    with open(path, "rb") as f:
        data = f.read()
    n, hlen, rlen = struct.unpack("<IHH", data[4:12])
    fields, off = [], 32
    while data[off] != 0x0D:
        name = data[off:off + 11].split(b"\0")[0].decode()
        fields.append((name, data[off + 16]))
        off += 32
    rows = []
    for i in range(n):
        rec, pos, row = data[hlen + i * rlen: hlen + (i + 1) * rlen], 1, {}
        for name, size in fields:
            row[name] = rec[pos:pos + size].decode("utf-8", "replace").strip()
            pos += size
        rows.append(row)
    return rows


def read_shp(path):
    with open(path, "rb") as f:
        data = f.read()
    out, off = [], 100
    while off < len(data):
        _, words = struct.unpack(">ii", data[off:off + 8])
        rec = data[off + 8: off + 8 + words * 2]
        off += 8 + words * 2
        if struct.unpack("<i", rec[:4])[0] == 0:
            out.append(None)
            continue
        bbox = struct.unpack("<4d", rec[4:36])
        nparts, npts = struct.unpack("<ii", rec[36:44])
        parts = list(struct.unpack(f"<{nparts}i", rec[44:44 + 4 * nparts])) + [npts]
        p0 = 44 + 4 * nparts
        pts = [struct.unpack("<2d", rec[p0 + 16 * k: p0 + 16 * k + 16]) for k in range(npts)]
        out.append((bbox, [pts[parts[k]:parts[k + 1]] for k in range(nparts)]))
    return out


def tiger_layer(folder, kind):
    base = os.path.join(folder, f"tl_2024_{COUNTY}_{kind}")
    return list(zip(read_shp(base + ".shp"), read_dbf(base + ".dbf")))


def download(folder):
    for kind, sub in (("roads", "ROADS"), ("areawater", "AREAWATER")):
        z = os.path.join(folder, f"{kind}.zip")
        urllib.request.urlretrieve(f"{TIGER}/{sub}/tl_2024_{COUNTY}_{kind}.zip", z)
        with zipfile.ZipFile(z) as f:
            f.extractall(folder)


# --- projection (local, isotropic) ---------------------------------------------------------------
LAT0, LON0 = CENTER
KX = W / SPAN_LON
KY = KX * 110_540 / (111_320 * math.cos(math.radians(LAT0)))
SPAN_LAT = H / KY
BOX = (LON0 - SPAN_LON * EXTENT * 0.55, LAT0 - SPAN_LAT * EXTENT * 0.55,
       LON0 + SPAN_LON * EXTENT * 0.55, LAT0 + SPAN_LAT * EXTENT * 0.55)
# the full drawn area in SVG units (the starting view is the middle W x H of it)
FX0, FY0 = W / 2 - W * EXTENT / 2, H / 2 - H * EXTENT / 2
FX1, FY1 = W / 2 + W * EXTENT / 2, H / 2 + H * EXTENT / 2


def xy(lon, lat):
    return (W / 2 + (lon - LON0) * KX, H / 2 - (lat - LAT0) * KY)


def hits(bbox):
    return not (bbox[2] < BOX[0] or bbox[0] > BOX[2] or bbox[3] < BOX[1] or bbox[1] > BOX[3])


def d_attr(pts, close=False):
    s = "M" + " L".join(f"{x:.0f} {y:.0f}" for x, y in pts)
    return s + (" Z" if close else "")


# --- geometry clean-up: keeps the SVG small -------------------------------------------------------
def simplify(pts, tol=0.9):
    """Douglas-Peucker: drop points that bend the line less than tol SVG units."""
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-9
    far, idx = 0.0, 0
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + x2 * y1 - y2 * x1) / norm
        if d > far:
            far, idx = d, k
    if far <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[:idx + 1], tol)[:-1] + simplify(pts[idx:], tol)


def clip_poly(ring, pad=40):
    """Sutherland-Hodgman: clip a polygon to the visible box (plus pad)."""
    edges = [(lambda p: p[0] >= FX0 - pad, None), (lambda p: p[0] <= FX1 + pad, None),
             (lambda p: p[1] >= FY0 - pad, None), (lambda p: p[1] <= FY1 + pad, None)]
    def cut(a, b, k):
        if k < 2:
            xv = FX0 - pad if k == 0 else FX1 + pad
            t = (xv - a[0]) / ((b[0] - a[0]) or 1e-9)
        else:
            yv = FY0 - pad if k == 2 else FY1 + pad
            t = (yv - a[1]) / ((b[1] - a[1]) or 1e-9)
        return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
    out = ring
    for k, (inside, _) in enumerate(edges):
        src, out = out, []
        if not src:
            break
        prev = src[-1]
        for cur in src:
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur, k))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur, k))
            prev = cur
    return out


# --- street chains (join block-by-block TIGER pieces into whole streets) ------------------------
def chains(segments):
    """segments: list of point lists sharing one name -> list of joined point lists."""
    key = lambda p: (round(p[0], 1), round(p[1], 1))
    segs = [list(s) for s in segments]
    joined = True
    while joined:
        joined = False
        for i in range(len(segs)):
            for j in range(len(segs)):
                if i == j or not segs[i] or not segs[j]:
                    continue
                a, b = segs[i], segs[j]
                if key(a[-1]) == key(b[0]):
                    segs[i] = a + b[1:]
                elif key(a[-1]) == key(b[-1]):
                    segs[i] = a + b[::-1][1:]
                elif key(a[0]) == key(b[-1]):
                    segs[i] = b + a[1:]
                elif key(a[0]) == key(b[0]):
                    segs[i] = b[::-1] + a[1:]
                else:
                    continue
                segs[j] = []
                joined = True
    return [s for s in segs if len(s) > 1]


def runs_inside(pts, m):
    """Split a chain into runs that stay inside the visible box (with margin m)."""
    out, cur = [], []
    for p in pts:
        if FX0 + m <= p[0] <= FX1 - m and FY0 + m <= p[1] <= FY1 - m:
            cur.append(p)
        elif cur:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return [r for r in out if len(r) > 1]


def point_at(pts, dist):
    acc = 0.0
    for k in range(len(pts) - 1):
        seg = math.dist(pts[k], pts[k + 1])
        if acc + seg >= dist:
            t = (dist - acc) / (seg or 1e-9)
            return (pts[k][0] + t * (pts[k + 1][0] - pts[k][0]), pts[k][1] + t * (pts[k + 1][1] - pts[k][1]))
        acc += seg
    return pts[-1]


def length(pts):
    return sum(math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1))


def readable(pts):
    """Text reads left to right; vertical streets read bottom to top (as on Apple Maps)."""
    dx, dy = pts[-1][0] - pts[0][0], pts[-1][1] - pts[0][1]
    return pts[::-1] if (dx < 0 if abs(dx) > abs(dy) * 0.25 else dy > 0) else pts


ORDINALS = {"FIRST": "1ST", "SECOND": "2ND", "THIRD": "3RD", "FOURTH": "4TH", "FIFTH": "5TH"}


def label_name(name):
    """Census lists some streets twice ("First St" and "1st St"); show one form, numerals, like Apple."""
    words = name.upper().split()
    return " ".join(ORDINALS.get(w, w) for w in words)


# --- build ---------------------------------------------------------------------------------------
def build(folder):
    roads = {"major": [], "street": [], "service": []}
    named = {}
    for shape, row in tiger_layer(folder, "roads"):
        tier = MTFCC.get(row.get("MTFCC", ""))
        if not shape or not tier or not hits(shape[0]):
            continue
        for part in shape[1]:
            pts = simplify([xy(lon, lat) for lon, lat in part])
            roads[tier].append(pts)
            name = row.get("FULLNAME", "")
            if name and tier != "service":
                named.setdefault((label_name(name), tier), []).append(pts)

    water = []
    for shape, row in tiger_layer(folder, "areawater"):
        if shape and hits(shape[0]):
            rings = [simplify(clip_poly([xy(lon, lat) for lon, lat in ring]), 1.2) for ring in shape[1]]
            rings = [r for r in rings if len(r) > 2]
            if rings:
                water.append((row.get("FULLNAME", ""), rings))

    # labels: one per visible run long enough to hold the name; skip the pin's corner
    defs, labels, placed = [], [], []
    pin_zone = (W / 2 - 60, H / 2 - 40, W / 2 + 250, H / 2 + 40)
    # the gallery's own street first, then main roads, then the rest
    order = lambda kv: (kv[0][0] != GALLERY_STREET, kv[0][1] != "major")
    for (name, tier), segs in sorted(named.items(), key=order):
        text = name
        size = LABEL_SIZE[tier]
        need = len(text) * size * 0.66 + 24
        for chain in chains(segs):
            for run in runs_inside(chain, 24):
                L = length(run)
                if L < need:
                    continue
                run = readable(run)
                # try the middle first, then further along, avoiding the pin and other labels
                spot = None
                fracs = (0.5, 0.32, 0.68, 0.2, 0.8)
                if name == GALLERY_STREET:  # as close to the pin as it can sit without touching it
                    fracs = sorted((k / 40 for k in range(2, 39)), key=lambda f: math.dist(point_at(run, L * f), (W / 2, H / 2)))
                for frac in fracs:
                    mid = point_at(run, L * frac)
                    half = need / 2
                    if L * frac < half or L * (1 - frac) < half:
                        continue
                    if pin_zone[0] < mid[0] < pin_zone[2] and pin_zone[1] < mid[1] < pin_zone[3]:
                        continue
                    if math.dist(mid, (W / 2, H / 2)) < half + 30:  # the label would run into the pin
                        continue
                    if any(math.dist(mid, q) < 85 for q in placed):
                        continue
                    spot = (frac, mid)
                    break
                if not spot:
                    continue
                placed.append(spot[1])
                pid = f"s{len(defs)}"
                defs.append(f'<path id="{pid}" d="{d_attr(run)}"/>')
                labels.append(f'<text class="pm-l pm-{tier}"><textPath href="#{pid}" startOffset="{round(spot[0] * 100)}%">{text}</textPath></text>')

    # water label: river name set vertically in the middle of the visible water
    water_label = ""
    for name, rings in water:
        if "Hudson" not in name:
            continue
        inside = [(x, y) for x in range(int(FX0), int(FX1), 30) for y in range(int(FY0), int(FY1), 30) if any(point_in(x, y, r) for r in rings)]
        if len(inside) > 40:
            cx = sorted(p[0] for p in inside)[len(inside) // 2]
            cy = sorted(p[1] for p in inside)[len(inside) // 2]
            water_label = f'<text class="pm-w" transform="translate({cx} {cy}) rotate(-90)">HUDSON RIVER</text>'

    def group(tier, attr):
        w = TIER[tier][0 if attr == "line" else 1]
        col = COL[tier] if attr == "line" else COL["edge"]
        return f'<path fill="none" stroke="{col}" stroke-width="{w}" d="{" ".join(d_attr(p) for p in roads[tier])}"/>'

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" '
        'role="img" aria-label="Map of the streets around 46 Chambers Street, Newburgh, between Broadway and First Street">',
        f"<defs>{''.join(defs)}</defs>",
        f'<rect x="{FX0 - 2000:.0f}" y="{FY0 - 2000:.0f}" width="{FX1 - FX0 + 4000:.0f}" height="{FY1 - FY0 + 4000:.0f}" fill="{COL["grass"]}"/>',
        f'<path fill="{COL["water"]}" fill-rule="evenodd" d="{" ".join(d_attr(r, True) for _, rings in water for r in rings)}"/>',
        '<g stroke-linecap="round" stroke-linejoin="round">',
        group("service", "edge"), group("street", "edge"), group("major", "edge"),
        group("service", "line"), group("street", "line"), group("major", "line"),
        "</g>",
        f'<g text-anchor="middle">{"".join(labels)}</g>',
        water_label,
        # the gallery: an orange dot with an ink ring, exactly at the center (its tag is drawn by the page)
        f'<circle cx="{W/2:.0f}" cy="{H/2:.0f}" r="19" fill="{COL["edge"]}" opacity=".9"/>',
        f'<circle cx="{W/2:.0f}" cy="{H/2:.0f}" r="14" fill="#E75D18" stroke="#111" stroke-width="3.5"/>',
        "</svg>",
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(svg) + "\n")
    print(f"wrote {os.path.normpath(OUT)}: {sum(len(v) for v in roads.values())} road pieces, "
          f"{len(labels)} street labels, {len(water)} water areas, {os.path.getsize(OUT) // 1024} KB")


def point_in(x, y, ring):
    inside, j = False, len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--tiger", help="folder with unzipped TIGER roads + areawater files")
    args = ap.parse_args()
    if args.tiger:
        build(args.tiger)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            download(tmp)
            build(tmp)
