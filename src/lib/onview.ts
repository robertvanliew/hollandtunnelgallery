// What's on: decides, from the show data and today's date, whether an exhibition is on view now,
// coming up, or whether the gallery is between shows. Home and Exhibitions use this so a show is
// never advertised as current after it closes. Evaluated at build time (redeploy daily, see README);
// lines carrying data-until="YYYY-MM-DD" also hide themselves in the browser once that date passes.
import { loadArchive, type Person, type Show } from './people';

export type Status = 'current' | 'upcoming' | 'between';

/** Today's date in Newburgh, as YYYY-MM-DD. Set HTG_TODAY=YYYY-MM-DD to preview the site on another day. */
export const todayNY = (d = new Date()) =>
  process.env.HTG_TODAY || d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

const asDate = (iso: string) => new Date(`${iso}T12:00:00`);
export const shortDate = (iso: string) => asDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const longDate = (iso: string) => asDate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const daysBetween = (a: string, b: string) => Math.round((asDate(b).getTime() - asDate(a).getTime()) / 86_400_000);

export interface OnView {
  status: Status;
  show: Show;
  people: Person[];
  today: string;
  end: string;
  /** Final weekend (Fri–Sun before closing) of a current show. */
  lastWeekend: boolean;
  /** Closed within the last 30 days. */
  justClosed: boolean;
}

export async function onView(today = todayNY()): Promise<OnView | null> {
  const a = await loadArchive();
  // Only exhibitions with full dates can be placed on the calendar.
  const ex = [...a.shows.values()].filter((s) => !s.isMusic && s.startDate.length === 10);
  const end = (s: Show) => (s.endDate && s.endDate.length === 10 ? s.endDate : s.startDate);
  const current = ex.find((s) => s.startDate <= today && end(s) >= today);
  const upcoming = ex.filter((s) => s.startDate > today).sort((x, y) => x.startDate.localeCompare(y.startDate))[0];
  const recent = ex.filter((s) => end(s) < today).sort((x, y) => end(y).localeCompare(end(x)))[0];
  const show = current ?? upcoming ?? recent;
  if (!show) return null;
  const status: Status = current ? 'current' : upcoming ? 'upcoming' : 'between';
  const people = (a.showPeople.get(show.id) ?? []).map((slug) => a.bySlug.get(slug)!);
  return {
    status,
    show,
    people,
    today,
    end: end(show),
    lastWeekend: status === 'current' && daysBetween(today, end(show)) <= 2,
    justClosed: status === 'between' && daysBetween(end(show), today) <= 30,
  };
}
