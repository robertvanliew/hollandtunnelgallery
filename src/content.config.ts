import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One JSON file per entry so a git-based CMS (Decap, Tina) or Sanity can map 1:1 onto these.
// Empty strings / arrays mean "unknown": templates hide them, they are never guessed.

const isoDate = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'ISO date: YYYY, YYYY-MM or YYYY-MM-DD');

const shows = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/shows' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      dates: z.string(), // as the gallery writes them, e.g. "Sep 12 – Oct 11, 2026"
      year: z.number().int(),
      venue: z.string(),
      type: z.string(), // "Exhibition", "Concert", "Performance", "Solo exhibition · curated by …"
      startDate: isoDate,
      endDate: isoDate.optional(),
      reception: z.string().optional(), // e.g. "Saturday, Sep 12, 3–6 pm"
      description: z.string().optional(), // short text shown on Home and Exhibitions while it's featured
      aboutTitle: z.string().optional(), // Exhibitions page "About the show" heading
      about: z.array(z.string()).optional(), // Exhibitions page "About the show" paragraphs
      image: image().optional(),
      imageAlt: z.string().optional(),
      // More photos for the show's page; each needs alt text (also used as the caption).
      gallery: z.array(z.object({ image: image(), alt: z.string() })).optional(),
      // A short clip from the show (an .mp4 in /public), with a still to show before it plays.
      video: z.object({ src: z.string(), poster: image(), caption: z.string() }).optional(),
    }),
});

const str = z.string().default('');
const list = <T extends z.ZodType>(t: T) => z.array(t).default([]);

const artists = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/artists' }),
  schema: ({ image }) =>
    z
      .object({
        name: z.string(),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        also_known_as: list(z.string()),
        kind: z.enum(['visual artist', 'multidisciplinary', 'musician', 'performer']),
        roles: list(z.string()),
        based_in: str,
        origin: str,
        born: str,
        died: str,
        education: list(z.object({ school: str, degree: str, year: str })),
        bio_short: z.string().min(1),
        bio_long: str,
        practice: str,
        career_timeline: list(z.object({ year: str, event: str })),
        selected_exhibitions: list(z.object({ year: str, title: str, venue: str, city: str })),
        collections: list(z.string()),
        awards_residencies: list(z.object({ year: str, name: str })),
        teaching: list(z.string()),
        press: list(z.object({ year: str, title: str, outlet: str, url: str })),
        recordings_or_publications: list(z.object({ year: str, title: str, label_or_publisher: str })),
        collaborators_and_connections: list(z.object({ name: str, relation: str })),
        links: z
          .object({
            website: str,
            instagram: str,
            wikipedia: str,
            wikidata: str,
            bandcamp: str,
            spotify: str,
            youtube: str,
            other: list(z.string()),
          })
          .default({}),
        verification: z.object({
          status: z.enum(['verified', 'likely', 'unverified']),
          evidence: str,
          sources: list(z.string()),
        }),
        open_questions: list(z.string()),
        // Appearances: the artist <-> show links. Every connection on the site is computed from these.
        shows: list(reference('shows')),
        image: image().optional(),
        imageAlt: z.string().optional(),
        // Artist film (shown on the profile and screened on school visits). YouTube, Vimeo or an .mp4.
        video: z
          .object({
            url: z.string().url(),
            title: z.string(),
            description: z.string().optional(),
            uploadDate: isoDate, // YYYY-MM-DD, required by Google for video results
            duration: z.string().regex(/^PT(\d+H)?(\d+M)?(\d+S)?$/, 'ISO 8601 duration, e.g. PT9M30S').optional(),
            poster: image(), // still frame shown before playing; also the video thumbnail for search
            captions: z.string().optional(), // path to a .vtt file in /public (for .mp4 films)
          })
          .optional(),
      })
      .refine((a) => !a.image || !!a.imageAlt, { message: 'imageAlt is required when image is set' }),
});

export const collections = { artists, shows };
