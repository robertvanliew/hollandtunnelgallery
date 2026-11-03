# Holland Tunnel Gallery website

Astro (static pages) on Vercel. Content lives in JSON files under `src/content/`, so a headless CMS (Decap, Tina or Sanity) can be connected later without changing any templates.

```
npm install
npm run dev        # http://localhost:4321
npm run build      # static pages + one Vercel function (/api/forms)
```

## Where things are

| Path | What |
|---|---|
| `src/content/artists/<slug>.json` | One file per artist or musician (the source of truth) |
| `src/content/shows/<id>.json` | One file per exhibition, concert or performance |
| `src/content.config.ts` | Typed schemas for both collections. The build fails on bad data |
| `src/assets/artists/`, `src/assets/shows/` | Images, optimized at build time (AVIF/WebP, responsive sizes) |
| `src/lib/people.ts` | Every computed connection: who showed with whom, the graph, counts |
| `src/pages/artists/` | Directory, profiles, claim forms |
| `src/pages/api/forms.ts` | Emails form submissions to the gallery inbox via Resend |
| `scripts/import-prototype.py` | One-off import from `../htg-artists` (already run; keep for the record) |

## Add an artist

1. Create `src/content/artists/<slug>.json`. The slug is lowercase with hyphens, e.g. `jane-doe`. Only `name`, `slug`, `kind`, `bio_short` and `verification` are required. Leave anything you don't know out: empty fields are hidden, never guessed.

   ```json
   {
     "name": "Jane Doe",
     "slug": "jane-doe",
     "kind": "visual artist",
     "roles": ["painter"],
     "bio_short": "Jane Doe is a Newburgh painter…",
     "bio_long": "",
     "verification": { "status": "likely", "evidence": "Gallery listing for …", "sources": ["https://…"] },
     "shows": ["unframed-2026"]
   }
   ```

   `kind` is one of `visual artist`, `multidisciplinary`, `musician` or `performer`. Musicians and performers show as black nodes and tiles.
2. `shows` lists the show ids this person was part of. That one list drives their Holland Tunnel record, the chips and connection wheels on everyone else in those shows, the network graph, the show pages and the directory filter. Don't write connections anywhere else.
3. Optional image: put the file in `src/assets/artists/` with a descriptive name (`jane-doe-river-study-2026.jpg`) and add
   `"image": "../../assets/artists/jane-doe-river-study-2026.jpg", "imageAlt": "Jane Doe, River Study, 2026"`. `imageAlt` is required when there's an image, and it's also used as the caption. Only use images from the gallery's own records or supplied by the artist.
4. `collaborators_and_connections` (`[{ "name", "relation" }]`) feeds the "Wider circle" list. Names that match someone in the directory get linked and appear on the wheel as dashed lines.

## Add a show

Create `src/content/shows/<id>.json`, where the id is a slug plus the year, e.g. `spring-salon-2027`:

```json
{
  "title": "Spring Salon",
  "dates": "Apr 3 – May 9, 2027",
  "year": 2027,
  "venue": "Holland Tunnel Revisited, Newburgh",
  "type": "Exhibition",
  "startDate": "2027-04-03",
  "endDate": "2027-05-09"
}
```

A `type` starting with "Concert" or "Performance" puts the page under `/events/<id>` with `MusicEvent` markup. Anything else goes under `/exhibitions/<id>` with `ExhibitionEvent` markup. Then add the id to each participant's `shows` list. Optional `image` and `imageAlt` work the same way as for artists (`src/assets/shows/`).

## Sharing

Every profile has a share panel under the verification badge:

- **Share…** opens the phone's own share sheet (Messages, WhatsApp, AirDrop, Instagram DMs…). Where that isn't available, and without JavaScript, it opens a list: Facebook, X, Threads, Bluesky, LinkedIn, WhatsApp, Pinterest, Email and the Story image.
- **Instagram Story** shares a 1080×1920 image of the profile as a file, which is what makes Instagram offer "Story". It also copies the profile link so it can be pasted into a Link sticker. On a computer it downloads the image instead.
- **Copy link** copies the profile URL.

Share links carry `utm_source` / `utm_medium=social` / `utm_campaign=artist_profile`, so each platform's traffic shows up separately in analytics.

The images are generated at build time from the profile data in the gallery's fonts and colors (`src/lib/shareCards.ts`): `/share/og/<slug>.jpg` (1200×630, used as the link preview everywhere) and `/share/story/<slug>.jpg`. Adding or editing an artist regenerates them.

New images from the old site sometimes have a white screenshot frame. Run `node scripts/trim-screenshot-frames.mjs` after adding images; it only trims near-white, thin borders.

## Move a profile from pending to verified

Profiles have one of three `verification.status` values:

| Status | Profile page | Search engines | Directory |
|---|---|---|---|
| `verified` | yes, green "Verified" badge | indexed, in the sitemap | card |
| `likely` | yes, amber "Pending confirmation" badge | `noindex`, not in the sitemap | card with "Pending confirmation" |
| `unverified` | no page | – | name only, under "Profiles in progress" |

When the gallery confirms the details (see `../htg-artists/CONFIRM-WITH-GALLERY.md`), set `"status": "verified"`, add the source to `sources`, remove the resolved items from `open_questions`, and redeploy. The badge, noindex tag, sitemap and cards all follow automatically. Update `LAST_REVIEWED` in `src/lib/site.ts` after a review pass.

## Launch switch

The site is a private demo: every page is `noindex` and `robots.txt` blocks everything. At launch, set `PUBLIC_SITE=true` in the Vercel project's environment variables (Production) and redeploy. `.env` keeps it `false` locally.

## Forms (claim profile, newsletter)

Both forms post to `/api/forms`, a Vercel function that emails the gallery through [Resend](https://resend.com). Nothing publishes automatically; Paulien reviews claim requests and applies them here or in the CMS.

In the Vercel project settings, add:

- `RESEND_API_KEY`: required to send.
- `FORMS_FROM`: e.g. `Holland Tunnel Gallery <forms@hollandtunnelgallery.com>` once the domain is verified in Resend. The default `onboarding@resend.dev` only delivers to the Resend account owner's own address.
- `FORMS_TO`: defaults to `hollandtunnelart@gmail.com`.

Without a key, the private demo logs submissions and still shows the thank-you page. The public site returns an error asking people to email instead. Photos are limited to 4 MB (Vercel's request size limit).

## Redirects

Old Squarespace URLs are 301-redirected in `astro.config.mjs` (`redirects`), including `/htgartists` → `/artists`. The Vercel adapter turns them into real 301 routes.

## What's on (Home and Exhibitions)

The Home hero, the first "Next up" card, the "Is it open?" answers and the Exhibitions page pick the featured exhibition from `src/content/shows` by date: the show **on view now**, else the next one **coming up**, else the **most recent** one ("next exhibition announced soon"). Nothing on those pages hard-codes a show.

To feature a new show, add its JSON file with full `startDate`/`endDate` (and ideally `image`, `imageAlt`, `description`, `reception`, `aboutTitle`, `about`).

Because the site is static, it decides at build time. Set a daily rebuild so it flips on opening and closing days: in Vercel, create a Deploy Hook (Settings → Git → Deploy Hooks) and call it once a day from a Vercel Cron Job or any scheduler. As a backup, any line marked `data-until="YYYY-MM-DD"` (such as "closes Oct 11") hides itself in the browser once that date has passed.

Preview the site on another day with `HTG_TODAY=2026-10-01 npm run build`.

## School visits

`/schools` is the field-trip program for grades 6–12: an artist film in the screening room, a guided look at the show, a hands-on workshop and a wrap-up. Teachers book with the form on that page (`form-name: school-visit`), which is emailed to the gallery inbox with school, grades, student count, dates, subject, how they'd like to meet the artist, and funding source. The workshop cards link to recent shows. Update them when a new exhibition opens.

Before going live, confirm with Paulien the group size, rates, the lesson plans and the paperwork the page promises (W-9 and invoice).

## Artist films

Add a film to any profile with a `video` field in `src/content/artists/<slug>.json`:

```json
"video": {
  "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
  "title": "Ken Butler in the studio",
  "description": "Ken Butler shows how he turns everyday objects into playable instruments.",
  "uploadDate": "2027-01-15",
  "duration": "PT9M30S",
  "poster": "../../assets/artists/ken-butler-film-still.jpg",
  "captions": "/films/ken-butler.vtt"
}
```

YouTube, Vimeo or a direct `.mp4` work. YouTube and Vimeo films show the still image until someone presses play, so nothing from those sites loads before then, and they open with captions on. `captions` (a `.vtt` file in `public/`) is for `.mp4` films; upload captions to YouTube or Vimeo directly. The profile gets an "Artist film" section after the biography, plus `VideoObject` structured data so the film can appear in Google video results.

Get a signed release from each artist covering classroom screenings, the website and social media.
