#!/usr/bin/env python3
"""One-off import of the approved prototype (../htg-artists) into Astro content collections.

Reads   ../htg-artists/artists-data.json and the SHOWS / APPEARANCES / IMAGES tables in
        ../htg-artists/build.py (imported directly, so nothing is retyped).
Writes  src/content/artists/<slug>.json   one file per person (+ `shows`, `image`, `imageAlt`)
        src/content/shows/<id>.json       one file per show (+ ISO `startDate` / `endDate`, `image`)
        src/assets/artists/*, src/assets/shows/*   images downloaded from the Squarespace CDN

After this runs once, src/content is the source of truth (and what a CMS edits).
Run:    python3 scripts/import-prototype.py
"""
import json, os, re, sys, unicodedata, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
PROTO = os.path.join(os.path.dirname(WEB), "htg-artists")
sys.path.insert(0, PROTO)
import build  # noqa: E402  (the prototype generator; only its data tables are used)

CONTENT = os.path.join(WEB, "src", "content")
ASSETS = os.path.join(WEB, "src", "assets")

# ---- Content rule: no family details except spouses who are documented creative partners.
# These strings break that rule, so they are removed from the migrated copy (the prototype
# data in ../htg-artists is left untouched). Each edit must match exactly once.
PRIVACY_EDITS = {
    "bix-lye": [
        ("bio_long", " and the dance teacher Jane Lye", ""),
        ("bio_long", " Lye was the partner of the gallery's founder, Paulien Lethen.", ""),
    ],
    "thornton-willis": [
        ("bio_long", "He was married to the painter Vered Lieb and died", "He died"),
    ],
}
# ---- The gallery is open. Wording that says it closed ("closing season", "final exhibition",
# "reactivated") is the framing the rebuild exists to fix, so it is neutralized. No facts change;
# real show titles such as "Finale and Beyond" stay as they are.
WORDING_EDITS = {
    "paulien-lethen": [
        ("bio_long",
         "Her retrospective Finale and Beyond (2023) closed the Newburgh program's original run; the space has since hosted exhibitions under the name Holland Tunnel Revisited.",
         "In 2023 the gallery showed her retrospective Finale and Beyond, and the Newburgh space now presents its program as Holland Tunnel Revisited."),
        ("career_timeline", "Retrospective Finale and Beyond; final Newburgh exhibition of the original program",
         "Retrospective Finale and Beyond at Holland Tunnel Newburgh"),
        ("career_timeline", "Chambers Street space reactivated as Holland Tunnel Revisited with Reclamation",
         "Holland Tunnel Revisited opens its current program at Chambers Street with Reclamation"),
    ],
    "ken-butler": [
        ("career_timeline", "at Holland Tunnel's closing season (Oct 28)", "at Holland Tunnel Newburgh (Oct 28)"),
    ],
    "julie-schatz": [
        # Lead with Soul Shades / Buzz in London (her main project), then the other releases.
        ("bio_long",
         " Her electronic releases include collaborations with Darksidevinyl",
         " With DJ DX she performs as Soul Shades, a violin, piano and DJ duo whose remix videos have drawn wide"
         " attention on social media. The duo's single Buzz in London (2024) was written and produced by Schatz and"
         " DJ DX. Her other electronic releases include collaborations with Darksidevinyl"),
        ("bio_long",
         " With DJ DX she performs as Soul Shades, a violin, piano and DJ duo whose remix videos have drawn wide attention on social media. At Holland",
         " At Holland"),
        ("bio_long", "guest singer and pianist at Final Blast, the closing party.",
         "guest singer and pianist at the Final Blast concert."),
    ],
}

# ---- Facts added after the research pass, each with its source.
ADDITIONS = {
    "julie-schatz": {
        # https://soulshadesmusic.bandcamp.com/track/buzz-in-london : released Dec 20, 2024;
        # "written and produced by Julie Schatz and DJ DX". No label listed, so none is given.
        "recordings_or_publications": [
            {"year": "2024", "title": "Buzz in London (Soul Shades feat. DJ DX & Julie Schatz)", "label_or_publisher": ""}],
        "career_timeline": [
            {"year": "2024", "event": "Releases the single Buzz in London with DJ DX as Soul Shades (Dec 20), written and produced by the duo"}],
        "verification.sources": ["https://soulshadesmusic.bandcamp.com/track/buzz-in-london"],
        "links.other": ["https://soulshadesmusic.bandcamp.com/"],
    },
}

DROP_CONNECTIONS = {  # (person slug, connection name)
    ("bix-lye", "Ruthven Todd"),      # "surrogate father": family detail
    ("thornton-willis", "Vered Lieb"),  # wife, not named as a creative partner
}
RELABEL_CONNECTIONS = {
    ("bix-lye", "Paulien Lethen"): "Founder of Holland Tunnel Gallery, who showed his work often",
    ("paulien-lethen", "Bix Lye"): "Sculptor shown frequently at Holland Tunnel Gallery",
}

MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def iso(y, m=None, d=None):
    return f"{int(y):04d}" + (f"-{m:02d}" if m else "") + (f"-{int(d):02d}" if d else "")


def parse_dates(s):
    """Turn the archive's human date strings into ISO start/end (end may be None)."""
    t = s.replace("–", "-").replace("—", "-").strip()
    t = re.sub(r"^Opened\s+", "", t)
    M = r"([A-Z][a-z]{2})[a-z]*"
    pats = [
        (rf"^{M} (\d+), (\d{{4}}) - {M} (\d+), (\d{{4}})$", lambda g: (iso(g[2], MONTHS[g[0].lower()], g[1]), iso(g[5], MONTHS[g[3].lower()], g[4]))),
        (rf"^{M} (\d+) - {M} (\d+), (\d{{4}})$", lambda g: (iso(g[4], MONTHS[g[0].lower()], g[1]), iso(g[4], MONTHS[g[2].lower()], g[3]))),
        (rf"^{M} (\d+) - {M} (\d{{4}})$", lambda g: (iso(g[3], MONTHS[g[0].lower()], g[1]), iso(g[3], MONTHS[g[2].lower()]))),
        (rf"^{M} (\d+)-(\d+), (\d{{4}})$", lambda g: (iso(g[3], MONTHS[g[0].lower()], g[1]), iso(g[3], MONTHS[g[0].lower()], g[2]))),
        (rf"^{M} (\d+), (\d{{4}})$", lambda g: (iso(g[2], MONTHS[g[0].lower()], g[1]), None)),
        (r"^(\d{4})$", lambda g: (iso(g[0]), None)),
    ]
    for rx, fn in pats:
        m = re.match(rx, t)
        if m:
            return fn(m.groups())
    raise ValueError(f"unparsed date: {s!r}")


def slugify(s, maxlen=90):
    s = re.sub(r"\(photo:[^)]*\)", "", s)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:maxlen].rstrip("-")


def download(key, path, caption, folder):
    ext = os.path.splitext(urllib.parse.unquote(path))[1].lower().replace(".jpeg", ".jpg")
    name = slugify(caption) + ext
    dest = os.path.join(ASSETS, folder, name)
    if not os.path.exists(dest):
        url = build.IMG + path  # original size, no ?format param
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (HTG site migration)"})
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
            f.write(r.read())
    print(f"  {key:28} -> {folder}/{name}")
    return f"../../assets/{folder}/{name}"


def main():
    people = json.load(open(os.path.join(PROTO, "artists-data.json")))
    by_name = {p["name"]: p for p in people}
    for d in ("artists", "shows"):
        os.makedirs(os.path.join(CONTENT, d), exist_ok=True)
        os.makedirs(os.path.join(ASSETS, d), exist_ok=True)

    # ---- shows
    shows = {}
    print("shows:")
    for sid, (title, dates, year, venue, typ) in build.SHOWS.items():
        start, end = parse_dates(dates)
        assert start.startswith(str(year)) or (end and end.startswith(str(year))) or sid == "esperanza-2018", (sid, start, year)
        show = {"title": title, "dates": dates, "year": year, "venue": venue, "type": typ,
                "startDate": start}
        if end:
            show["endDate"] = end
        if sid in build.IMAGES:
            path, cap = build.IMAGES[sid]
            show["image"] = download(sid, path, cap, "shows")
            show["imageAlt"] = cap
        shows[sid] = show
        print(f"  {sid:28} {dates:32} -> {start} .. {end or ''}")

    # ---- artists
    print("artists:")
    missing = [n for n in build.APPEARANCES if n not in by_name]
    assert not missing, f"APPEARANCES names not in data: {missing}"
    for p in people:
        slug = p["slug"]
        for field, old, new in PRIVACY_EDITS.get(slug, []) + WORDING_EDITS.get(slug, []):
            if field == "career_timeline":
                hits = [x for x in p[field] if old in x["event"]]
                assert len(hits) == 1, (slug, old)
                hits[0]["event"] = hits[0]["event"].replace(old, new)
            else:
                assert p[field].count(old) == 1, (slug, old)
                p[field] = p[field].replace(old, new)
        for field, items in ADDITIONS.get(slug, {}).items():
            obj, key = (p[field.split(".")[0]], field.split(".")[1]) if "." in field else (p, field)
            new = [x for x in items if x not in obj[key]]
            if field == "recordings_or_publications":
                obj[key] = new + obj[key]  # added recordings lead the list
            else:
                obj[key] = obj[key] + new
            if field == "career_timeline":
                obj[key].sort(key=lambda x: x.get("year") or "0000")
        p["collaborators_and_connections"] = [
            c for c in p["collaborators_and_connections"] if (slug, c.get("name")) not in DROP_CONNECTIONS]
        for c in p["collaborators_and_connections"]:
            if (slug, c.get("name")) in RELABEL_CONNECTIONS:
                c["relation"] = RELABEL_CONNECTIONS[(slug, c["name"])]
        # appearances: newest first
        ids = build.APPEARANCES.get(p["name"], [])
        p["shows"] = sorted(ids, key=lambda s: shows[s]["startDate"], reverse=True)
        if slug in build.IMAGES:
            path, cap = build.IMAGES[slug]
            p["image"] = download(slug, path, cap, "artists")
            p["imageAlt"] = cap
        # check the prototype's hand-made hero fallback equals "newest show with an image",
        # which the site computes from data instead
        fb = build.SHOW_IMAGE_FALLBACK.get(slug)
        computed = next((s for s in p["shows"] if "image" in shows[s]), None)
        if fb and "image" not in p:
            assert fb == computed, (slug, fb, computed)
        out = {k: p[k] for k in ["name", "slug"] + [k for k in p if k not in ("name", "slug")]}
        json.dump(out, open(os.path.join(CONTENT, "artists", f"{slug}.json"), "w"), ensure_ascii=False, indent=2)
    for sid, show in shows.items():
        path = os.path.join(CONTENT, "shows", f"{sid}.json")
        if os.path.exists(path):  # keep fields added since the import (description, reception, about…)
            existing = json.load(open(path))
            show = {**show, **{k: v for k, v in existing.items() if k not in show}}
        json.dump(show, open(path, "w"), ensure_ascii=False, indent=2)
    print(f"wrote {len(people)} artists, {len(shows)} shows")


if __name__ == "__main__":
    main()
