// Flood Watch example service worker.
// Bump VERSION whenever any SHELL file changes: the browser only installs a new
// worker when sw.js is byte-different (web.dev/learn/pwa/service-workers).
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const DATA_CACHE = 'data-v1'; // forecast responses; schema version, not app version
const SHELL = [
  '/',
  '/index.html',
  '/app.css',
  '/app.js',
  '/install.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon-180.png',
];
const DATA_HOSTS = new Set([
  'api.open-meteo.com',
  'marine-api.open-meteo.com',
  'api.tidesandcurrents.noaa.gov',
  'api.weather.gov',
]);

self.addEventListener('install', (event) => {
  // addAll is atomic: if one file fails, nothing is cached and install fails.
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  // No skipWaiting() here: the page asks for it after the user taps "Reload".
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, DATA_CACHE]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim(); // control already-open pages on first install
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // let the browser handle it
  const url = new URL(req.url);

  // Authenticated / dynamic: never cache (network only = don't intercept).
  if (url.origin === self.location.origin &&
      (url.pathname.startsWith('/api/') || url.pathname.startsWith('/console'))) return;

  if (DATA_HOSTS.has(url.hostname)) {
    event.respondWith(networkFirstWithFetchedAt(req));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  // Navigations (any ?query, e.g. start_url "/?source=pwa") fall back to the shell page.
  const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' }) ||
              (req.mode === 'navigate' ? await cache.match('/index.html') : undefined);
  if (hit) return hit;
  return fetch(req);
}

async function networkFirstWithFetchedAt(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) {
      // Store a copy stamped with the time we fetched it, so the UI can show its age.
      const body = await res.clone().arrayBuffer();
      const headers = new Headers(res.headers);
      headers.set('X-Fetched-At', new Date().toISOString());
      // Cross-origin (CORS) responses hide non-safelisted headers from the page
      // unless they are listed here.
      headers.set('Access-Control-Expose-Headers', 'X-Fetched-At');
      await cache.put(req, new Response(body, { status: res.status, headers }));
    }
    return res; // live response: no X-Fetched-At, so the page knows it is fresh
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached; // carries X-Fetched-At: the page shows its age
    throw err;
  }
}
