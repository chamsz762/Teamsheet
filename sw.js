/* TeamSheet service worker
 * Strategie: NETWORK-FIRST. Met internet krijg je altijd de nieuwste bestanden van GitHub Pages
 * (revalidatie met cache:'no-cache', dus nooit een verouderde HTTP-cache). Zonder internet valt de app
 * terug op de cache, zodat hij offline blijft werken.
 *
 * NIEUWE RELEASE? Verhoog VERSION hieronder (en APP_VERSION in app.js) – meer is niet nodig.
 * Gebruikersgegevens staan in IndexedDB/localStorage en worden hier NOOIT aangeraakt.
 */
const VERSION = '1.3';
const CACHE = 'teamsheet-v' + VERSION;
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon.png'
];
const NETWORK_TIMEOUT = 3500; // trage verbinding: na 3,5 s tijdelijk de cache tonen

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => fetch(new Request(u, { cache: 'reload' })).then((r) => {
        if (!r.ok) throw new Error('Cache mislukt: ' + u);
        return c.put(u, r);
      }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // alleen CACHES van oudere versies verwijderen – geen gebruikersdata
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromCache(req) {
  if (req.mode === 'navigate') {
    return caches.match('./index.html').then((hit) => hit || caches.match(req, { ignoreSearch: true }));
  }
  return caches.match(req, { ignoreSearch: true });
}

function networkFirst(req) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (res) => {
      if (settled || !res) return false;
      settled = true; resolve(res); return true;
    };
    const timer = setTimeout(() => { fromCache(req).then(settle); }, NETWORK_TIMEOUT);

    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? './index.html' : req, copy));
        settle(res);
      } else {
        // serverfout of 404: liever de laatst bekende goede versie
        fromCache(req).then((hit) => { if (!settle(hit)) settle(res); });
      }
    }).catch(() => {
      clearTimeout(timer);
      fromCache(req).then((hit) => { if (!settle(hit)) settle(Response.error()); });
    });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // sw.js zelf nooit onderscheppen: de app leest hiermee de nieuwste versie van de server
  if (url.pathname.endsWith('/sw.js')) return;
  event.respondWith(networkFirst(req));
});
