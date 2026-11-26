Source: https://web.dev/learn/pwa/caching
Source: https://web.dev/learn/pwa/serving
Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
Source: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
Retrieved: 2026-11-26

# Caching strategies, offline, and background work

## Cache Storage API (web.dev "Caching")
- `caches.open(name)` → promise of a `Cache` (creates it if missing).
- `cache.add(req)` stores one response; `cache.addAll([...])` stores a group **atomically**: if any
  file fails, nothing is added (so one missing shell file fails the SW install).
- `cache.put(req, res)` writes/overwrites; `cache.match(req)` reads; `cache.delete(req)` removes;
  `caches.keys()` + `caches.delete(name)` remove whole caches (do this in `activate`).
- `response.clone()` before caching: "request and response streams can only be read once" (MDN).
- Quota/eviction is not covered on these pages — (unconfirmed) here. Our rule regardless:
  iOS can evict storage; the app must work with an empty cache (skill `ios-android-pwa-behavior`).

## Strategies (web.dev "Serving")
| Strategy | Behaviour | Flood Watch use |
|---|---|---|
| Cache first | cache, else network | app shell (HTML/CSS/JS/icons/cities.json) |
| Network first | network, else cache | Open-Meteo, NOAA, NWS data |
| Stale-while-revalidate | serve cache now, refresh cache in background | not for risk data (would show stale scores as current) |
| Network only | always network, never cache | `/api/*`, `/console/*` (we simply don't intercept) |
| Cache only | cache or error; must be pre-cached | not used |

MDN adds: cache-first is "more likely to return a stale response"; network-first falls back to the
cache when offline. "The optimal caching strategy is dependent on the particular web app."

## Flood Watch rules (skill `data-freshness-offline`) and how the example implements them
- Every cached data response carries its fetch time. Example: the SW stores a copy with header
  `X-Fetched-At: <ISO time>` and **only the cached copy** has it, so the page knows "this came from
  cache because the network failed".
- Cross-origin gotcha (found while verifying 2026-11-26): the page's `fetch()` to Open-Meteo is a
  CORS request, so the page only sees CORS-safelisted headers. A custom `X-Fetched-At` is invisible
  unless the stored response also has `Access-Control-Expose-Headers: X-Fetched-At`.
- UI wording when serving cache: "Offline — forecast from N min/h ago. Check NWS for current alerts."
- Never present cached **alerts** as current; > 30 min old → "Alert status unknown" (skill rule).
- Navigations: match with `{ ignoreSearch: true }` so `start_url` `/?source=pwa` hits the cached `/`.
- Only intercept `GET`; never cache `/api/*` or `/console/*` (authenticated, dynamic).

## Fetch handler shape
```js
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;                 // browser handles it
  if (url.pathname.startsWith('/api/')) return;                // network only
  if (DATA_HOSTS.has(url.hostname)) return event.respondWith(networkFirstWithFetchedAt(event.request));
  if (url.origin === location.origin) event.respondWith(cacheFirst(event.request));
});
```
Full version: `../examples/app/sw.js`.

## Background APIs (MDN "Offline and background operation")
| API | What | Permission / limits | Flood Watch |
|---|---|---|---|
| Background Sync (`registration.sync.register(tag)` → SW `sync` event) | retry a task when connectivity returns | no permission; only registered while app open; limited retries | not needed (read-only app) |
| Background Fetch (`registration.backgroundFetch.fetch(id, reqs, ui)`) | long downloads with browser progress UI; events `backgroundfetchsuccess/fail/abort/click` | `"background-fetch"` permission | no |
| Periodic Background Sync (`registration.periodicSync.register(tag, { minInterval })`) | periodic refresh while app closed; browser decides frequency based on engagement | `"periodic-background-sync"` permission | maybe v2, Chromium only (our docs/02) |
| Push (`PushManager.subscribe()` with VAPID key → SW `push` → `showNotification()`) | server-sent messages | `"push"` permission; every push must show a notification (no silent push in any browser) | v2 (skill `web-push`) |

Background Sync/Periodic Sync are Chromium-only per our `docs/02`; the MDN guide itself does not
list browser support — (unconfirmed) on that page.

## Verified behaviour (example)
`node verify.mjs` (2026-11-26): after one online load, `context.setOffline(true)` + reload shows the
cached shell, the cached rain total and "Offline — forecast from 0 min ago…".
