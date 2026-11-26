// Minimal SW for the fixture: shell cache-first, Open-Meteo network-first with X-Fetched-At.
const SHELL = 'shell-v1', DATA = 'data-v1';
self.addEventListener('install', (e) => e.waitUntil(
  caches.open(SHELL).then((c) => c.addAll(['/', '/app.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']))));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.hostname === 'api.open-meteo.com') {
    e.respondWith((async () => {
      const cache = await caches.open(DATA);
      try {
        const res = await fetch(e.request);
        const headers = new Headers(res.headers);
        headers.set('X-Fetched-At', new Date().toISOString());
        headers.set('Access-Control-Expose-Headers', 'X-Fetched-At');
        await cache.put(e.request, new Response(await res.clone().arrayBuffer(), { status: res.status, headers }));
        return res;
      } catch (err) {
        return (await cache.match(e.request)) || Promise.reject(err);
      }
    })());
  } else if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
  }
});
