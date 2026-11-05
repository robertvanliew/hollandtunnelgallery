// "This weekend" line in Plan your visit: Saturday and Sunday (the open days) from the U.S. National
// Weather Service forecast for 46 Chambers Street. NWS data is public domain: no key, no credit line,
// no tracking. Fetched only when the visitor scrolls near the section, kept for an hour, and the row
// stays hidden if anything fails, so there is never an empty box.
const FORECAST = 'https://api.weather.gov/gridpoints/OKX/28,78/forecast';
const CACHE_KEY = 'htg-wx';
const TTL = 60 * 60 * 1000;

interface Period { startTime: string; endTime: string; isDaytime: boolean; temperature: number; shortForecast: string; probabilityOfPrecipitation?: { value: number | null } }

const ICON: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
  partly: '<path d="M8 3.5v1.6M3.6 8H2M4.9 4.9l1.1 1.1M12.6 6.1A4 4 0 0 0 5.2 9.6"/><path d="M8.5 20h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 8.5 20z"/>',
  cloud: '<path d="M7 19h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.3 3.3 0 0 0 7 19z"/>',
  rain: '<path d="M7 15h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 3M12.5 18l-1 3M17 18l-1 3"/>',
  snow: '<path d="M7 14h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.3 3.3 0 0 0 7 14z"/><path d="M8 18.5h.01M12 20.5h.01M16 18.5h.01M10 22h.01M14 22h.01"/>',
  storm: '<path d="M7 14h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.6A3.3 3.3 0 0 0 7 14z"/><path d="M12.5 15.5 10.5 19h3l-2 3.5"/>',
};
const iconFor = (text: string) => {
  const t = text.split(' then ')[0].toLowerCase();
  if (/thunder|storm/.test(t)) return 'storm';
  if (/snow|sleet|flurr|ice|freezing/.test(t)) return 'snow';
  if (/rain|shower|drizzle/.test(t)) return 'rain';
  if (/partly|mostly sunny|mostly clear/.test(t)) return 'partly';
  if (/cloud|overcast|fog|haze/.test(t)) return 'cloud';
  return 'sun';
};
// "Mostly Sunny then Chance Light Rain" -> "Mostly sunny, then chance light rain"
const plain = (s: string) => { const l = s.replace(/ then /g, ', then ').toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); };
const nyDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const nyDay = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });

async function periods(): Promise<Period[]> {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null');
    if (c && Date.now() - c.t < TTL) return c.p;
  } catch { /* storage unavailable: just fetch */ }
  const res = await fetch(FORECAST, { headers: { Accept: 'application/geo+json' } });
  if (!res.ok) throw new Error(`forecast ${res.status}`);
  const p: Period[] = (await res.json()).properties.periods;
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), p })); } catch { /* fine */ }
  return p;
}

async function render(dd: HTMLElement) {
  const now = new Date();
  const today = nyDate(now);
  // daytime Saturday/Sunday periods that haven't ended, picked by date (holidays rename days, e.g. "Veterans Day")
  const weekend = (await periods())
    .filter((p) => p.isDaytime && new Date(p.endTime) > now && /Sat|Sun/.test(nyDay(new Date(p.startTime))))
    .slice(0, 2);
  if (!weekend.length) return;
  const list = dd.querySelector('.h-wx-list') as HTMLElement;
  for (const p of weekend) {
    const start = new Date(p.startTime);
    const day = nyDate(start) === today ? 'Today' : nyDay(start);
    const rain = p.probabilityOfPrecipitation?.value ?? 0;
    const li = document.createElement('li');
    li.innerHTML = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[iconFor(p.shortForecast)]}</svg><b></b><span></span>`;
    (li.querySelector('b') as HTMLElement).textContent = `${day} ${p.temperature}°`;
    (li.querySelector('span') as HTMLElement).textContent = plain(p.shortForecast) + (rain >= 30 ? ` · ${rain}% chance of rain` : '');
    list.append(li);
  }
  dd.hidden = false;
  (dd.previousElementSibling as HTMLElement).hidden = false;
}

const dd = document.querySelector<HTMLElement>('dd[data-wx]');
const section = document.getElementById('visit');
if (dd && section && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    render(dd).catch(() => { /* forecast unavailable: the row simply stays hidden */ });
  }, { rootMargin: '600px 0px' });
  io.observe(section);
}
