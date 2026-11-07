// IndexNow: tell Bing (which also feeds Copilot, ChatGPT search, DuckDuckGo and Yahoo), Yandex, Naver,
// Seznam and Yep that pages changed, so they recrawl in minutes instead of weeks. Google does not use
// IndexNow; it reads the sitemap (submitted in Search Console).
//
//   node scripts/indexnow.mjs                 every URL in the live sitemap
//   node scripts/indexnow.mjs /rent /about    just these paths
//
// The key is public by design: it is served at https://www.hollandtunnelgallery.com/<key>.txt so the
// search engines can confirm the request comes from the site owner. Runs after each deploy
// (.github/workflows/indexnow.yml). Uses only Node's built-in fetch.
const HOST = 'www.hollandtunnelgallery.com';
const ORIGIN = `https://${HOST}`;
const KEY = '4d09150adb302f203bc59c767c7dced6';

async function sitemapUrls() {
  const index = await (await fetch(`${ORIGIN}/sitemap-index.xml`)).text();
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = [];
  for (const m of maps) {
    const xml = await (await fetch(m)).text();
    urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]));
  }
  return urls;
}

const args = process.argv.slice(2);
const urlList = args.length ? args.map((p) => new URL(p, ORIGIN).href) : await sitemapUrls();
if (!urlList.length) throw new Error('No URLs to submit');

// The key file must be live before submitting, or the engines reject the batch.
const keyCheck = await fetch(`${ORIGIN}/${KEY}.txt`);
if (!keyCheck.ok || (await keyCheck.text()).trim() !== KEY) throw new Error(`Key file not live at ${ORIGIN}/${KEY}.txt`);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList }),
});
// 200 = accepted, 202 = accepted (key being verified). Anything else is a real error.
console.log(`IndexNow: ${res.status} ${res.statusText} · ${urlList.length} URLs`);
if (res.status !== 200 && res.status !== 202) {
  console.error(await res.text());
  process.exit(1);
}
