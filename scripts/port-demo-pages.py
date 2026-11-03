#!/usr/bin/env python3
"""One-off port of the earlier static demo pages (../site/*.html) into Astro pages that use the
shared Base layout (header, footer, SEO head). Their page-body CSS moves to src/styles/pages.css."""
import json, os, re, shutil

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD = os.path.join(os.path.dirname(WEB), "site")

PAGES = {  # old file -> (astro page, path, nav key)
    "index.html": ("src/pages/index.astro", "/", None),
    "rent.html": ("src/pages/rent.astro", "/rent", "rent"),
    "exhibitions.html": ("src/pages/exhibitions/index.astro", "/exhibitions", "exhibitions"),
    "about.html": ("src/pages/about.astro", "/about", "about"),
}
LINKS = [
    (r'href="index\.html#', 'href="/#'), (r'href="index\.html"', 'href="/"'),
    (r'href="exhibitions\.html', 'href="/exhibitions'), (r'href="rent\.html', 'href="/rent'),
    (r'href="about\.html', 'href="/about'), (r'src="img/', 'src="/img/'),
]


def attr(html, pat):
    m = re.search(pat, html, re.S)
    return m.group(1) if m else ""


for old, (dest, path, key) in PAGES.items():
    src = open(os.path.join(OLD, old)).read()
    title = attr(src, r"<title>(.*?)</title>")
    desc = attr(src, r'<meta name="description" content="(.*?)">')
    ld = attr(src, r'<script type="application/ld\+json">(.*?)</script>')
    body = attr(src, r'<main id="main">(.*?)</main>')
    for a, b in LINKS:
        body = re.sub(a, b, body)
    body = body.replace("{", "&#123;").replace("}", "&#125;")  # literal braces in Astro templates
    jsonld = json.dumps(json.loads(ld), ensure_ascii=False, indent=2) if ld else "undefined"
    depth = "../" * dest.count("/", len("src/pages/"))
    out = f"""---
// Ported from the static demo ({old}) by scripts/port-demo-pages.py
import Base from '{depth}../layouts/Base.astro';
import '{depth}../styles/pages.css';
const jsonld = {jsonld};
---
<Base title={{{json.dumps(title.replace('&amp;', '&'))}}} description={{{json.dumps(desc.replace('&amp;', '&'))}}} path="{path}"{f' active="{key}"' if key else ''} jsonld={{jsonld}}>
{body}
<script src="/js/site.js" is:inline defer></script>
</Base>
"""
    os.makedirs(os.path.dirname(os.path.join(WEB, dest)), exist_ok=True)
    open(os.path.join(WEB, dest), "w").write(out)
    print("wrote", dest)

# page-body CSS: everything except the old header/nav/footer/concept ribbon
css = open(os.path.join(OLD, "css", "style.css")).read()
for block in ["Concept ribbon", "Header", "Footer"]:
    css = re.sub(rf"/\* -+ {block} -+ \*/.*?(?=/\* -+ )", "", css, flags=re.S)
css = css.replace("font-size: 22px;\n  letter-spacing: .08em;\n  text-decoration: none;", "font-size: 24px;\n  letter-spacing: .06em;\n  text-decoration: none;")
open(os.path.join(WEB, "src/styles/pages.css"), "w").write(
    "/* Page-body styles for Home, Rent, Exhibitions and About (ported from the static demo).\n"
    "   Header/footer come from chrome.css. Orange buttons use 24px type for contrast. */\n" + css)
print("wrote src/styles/pages.css")

# assets + the demo form handler
shutil.copytree(os.path.join(OLD, "img"), os.path.join(WEB, "public", "img"), dirs_exist_ok=True)
os.makedirs(os.path.join(WEB, "public", "js"), exist_ok=True)
js = open(os.path.join(OLD, "js", "site.js")).read()
js = re.sub(r"// Mobile nav.*?\n}\n\n", "", js, flags=re.S)
open(os.path.join(WEB, "public", "js", "site.js"), "w").write(js)
print("copied img/ and js/site.js")
