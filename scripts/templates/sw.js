// Service worker: makes the installed web app open instantly and work offline
// (handy inside stores with bad signal). Generated into dist/ by postexport.mjs.
const CACHE = 'grocery-saver-__BUILD_ID__';
const BASE = '__BASE_URL__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('grocery-saver-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Pages: try the network for the latest version, fall back to the cached app shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // GitHub Pages answers deep links with 404.html (status 404) – that's still the app.
          if (res.ok || res.status === 404) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(`${BASE}/index.html`, copy));
          }
          return res;
        })
        .catch(() => caches.match(`${BASE}/index.html`)),
    );
    return;
  }

  // Everything else (hashed JS, fonts, icons) never changes for a given URL: cache first.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
