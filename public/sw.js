// Flood Watch service worker. VERSION and SHELL are filled in by scripts/build.mjs from a content hash
// of the shell files, so any shell change installs a new worker (and the update banner appears).
// sw.js is on the Agent Console deny-list: changes go through a normal human-reviewed commit.
const VERSION = '__FW_VERSION__';
const SHELL = [/*__FW_SHELL__*/];
const SHELL_CACHE = `shell-${VERSION}`;
const DATA_CACHE = 'data-v1'; // forecast responses; schema version, not app version
const DATA_MAX_ENTRIES = 60;
const AUTH_HOST = 'ygdswggaxtyzlcscgdrf.supabase.co'; // Supabase Auth: network only
const DATA_HOSTS = new Set(['api.open-meteo.com', 'marine-api.open-meteo.com', 'api.tidesandcurrents.noaa.gov', 'api.weather.gov']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL))); // atomic: all or nothing
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, DATA_CACHE]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Accounts: Supabase requests and /auth callbacks go straight to the network, never cached or intercepted.
  if (url.hostname === AUTH_HOST || (url.origin === self.location.origin && (url.pathname === '/auth' || url.pathname.startsWith('/auth/')))) return;
  // Authenticated / dynamic: never cache, never intercept.
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/console'))) return;
  if (DATA_HOSTS.has(url.hostname)) { event.respondWith(networkFirst(req)); return; }
  if (url.origin === self.location.origin) event.respondWith(shellFirst(req));
});

// Tide URLs carry dates; key the cache without them so an offline reload still finds the last tides.
function dataKey(req) {
  const u = new URL(req.url);
  u.searchParams.delete('begin_date');
  u.searchParams.delete('end_date');
  return u.toString();
}

async function shellFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const nav = req.mode === 'navigate';
  const hit = (await cache.match(req, { ignoreSearch: nav })) || (nav ? await cache.match('/index.html') : undefined);
  if (hit) return hit;
  return fetch(req);
}

async function networkFirst(req) {
  const cache = await caches.open(DATA_CACHE);
  const key = dataKey(req);
  try {
    const res = await fetch(req);
    if (res.ok) {
      const body = await res.clone().arrayBuffer();
      const headers = new Headers(res.headers);
      headers.set('X-Fetched-At', new Date().toISOString());
      headers.set('Access-Control-Expose-Headers', 'X-Fetched-At');
      await cache.put(key, new Response(body, { status: res.status, headers }));
      trim(cache);
    }
    return res; // live response: no X-Fetched-At, so the page knows it is fresh
  } catch (err) {
    const cached = await cache.match(key);
    if (cached) return cached; // stamped: the page shows its age and an offline banner
    throw err;
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - DATA_MAX_ENTRIES))) await cache.delete(k);
}
