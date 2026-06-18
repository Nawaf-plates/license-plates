// Service worker for "مزاد لوحات السيارات" (Plate Auction app)
// Strategy:
//  - App shell + all local assets: precached on install, served cache-first
//    so the whole app works with zero network connection.
//  - Cross-origin requests (Google Fonts): cache-as-you-go, so once the
//    fonts are fetched the first time online, they keep working offline too.

const CACHE_VERSION = 'v1';
const CACHE_NAME = 'plate-auction-' + CACHE_VERSION;

const PRECACHE_URLS = [
  './',
  './assets/filters/all.svg',
  './assets/filters/personal.svg',
  './assets/filters/sport.svg',
  './assets/filters/transport.svg',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-16.png',
  './assets/icons/favicon-32.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/icon-512.png',
  './assets/letters/ar/a.svg',
  './assets/letters/ar/b.svg',
  './assets/letters/ar/d.svg',
  './assets/letters/ar/e.svg',
  './assets/letters/ar/g.svg',
  './assets/letters/ar/h.svg',
  './assets/letters/ar/j.svg',
  './assets/letters/ar/k.svg',
  './assets/letters/ar/l.svg',
  './assets/letters/ar/n.svg',
  './assets/letters/ar/r.svg',
  './assets/letters/ar/s.svg',
  './assets/letters/ar/t.svg',
  './assets/letters/ar/u.svg',
  './assets/letters/ar/v.svg',
  './assets/letters/ar/x.svg',
  './assets/letters/ar/z.svg',
  './assets/letters/en/a.svg',
  './assets/letters/en/b.svg',
  './assets/letters/en/d.svg',
  './assets/letters/en/e.svg',
  './assets/letters/en/g.svg',
  './assets/letters/en/h.svg',
  './assets/letters/en/j.svg',
  './assets/letters/en/k.svg',
  './assets/letters/en/l.svg',
  './assets/letters/en/n.svg',
  './assets/letters/en/r.svg',
  './assets/letters/en/s.svg',
  './assets/letters/en/t.svg',
  './assets/letters/en/u.svg',
  './assets/letters/en/v.svg',
  './assets/letters/en/x.svg',
  './assets/letters/en/z.svg',
  './assets/logo.svg',
  './assets/numbers/ar/0.svg',
  './assets/numbers/ar/1.svg',
  './assets/numbers/ar/2.svg',
  './assets/numbers/ar/3.svg',
  './assets/numbers/ar/4.svg',
  './assets/numbers/ar/5.svg',
  './assets/numbers/ar/6.svg',
  './assets/numbers/ar/7.svg',
  './assets/numbers/ar/8.svg',
  './assets/numbers/ar/9.svg',
  './assets/numbers/en/0.svg',
  './assets/numbers/en/1.svg',
  './assets/numbers/en/2.svg',
  './assets/numbers/en/3.svg',
  './assets/numbers/en/4.svg',
  './assets/numbers/en/5.svg',
  './assets/numbers/en/6.svg',
  './assets/numbers/en/7.svg',
  './assets/numbers/en/8.svg',
  './assets/numbers/en/9.svg',
  './assets/plates/ar-blue-long.svg',
  './assets/plates/ar-blue-wide.svg',
  './assets/plates/ar-green-log.svg',
  './assets/plates/ar-white-long.svg',
  './assets/plates/ar-white-wide.svg',
  './assets/plates/ar-yellow-logo.svg',
  './assets/plates/en-plate.svg',
  './assets/plates/plate-1.svg',
  './assets/plates/plate-2.svg',
  './assets/plates/plate-3.svg',
  './assets/plates/plate-4.svg',
  './assets/plates/plate-5.svg',
  './assets/plates/plate-6.svg',
  './assets/plates/plate-7.svg',
  './assets/plates/plate-8.svg',
  './assets/plates/plate-9.svg',
  './assets/price-bg.svg',
  './assets/sar-symbol.svg',
  './css/styles.css',
  './index.html',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // Cache-first for everything that belongs to the app itself.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // Cross-origin (Google Fonts CSS + woff2 files): stale-while-revalidate.
  // First successful fetch gets cached; after that, cached copy is served
  // instantly and refreshed in the background when online.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
