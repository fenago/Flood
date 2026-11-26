Source: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
Source: https://web.dev/learn/pwa/service-workers
Source: https://web.dev/learn/pwa/update
Retrieved: 2026-11-26

# Service worker lifecycle and updates

## Registration and scope
- `navigator.serviceWorker.register('/sw.js', { scope: '/' })` (MDN `ServiceWorkerContainer.register()`).
- "The folder your service worker sits in determines its scope" (web.dev). A worker at
  `/my-pwa/sw.js` controls navigations at or under `/my-pwa/`. Put `sw.js` at the site root so it
  controls `/`. "Only one service worker is allowed per scope."
- Service workers run only over HTTPS (localhost allowed for development). Registration can fail
  in some browser settings, e.g. private browsing (MDN).
- A SW cannot be served from another origin. Netlify: serve `/sw.js` with `Cache-Control: no-cache`
  (our `docs/02`), so update checks always revalidate.

## Lifecycle (MDN + web.dev)
1. **Parse/install** — `install` fires once per worker version. Use
   `event.waitUntil(promise)`: the worker "will not install until the code inside `waitUntil()` has
   successfully occurred". If the promise rejects (e.g. one `cache.addAll` file 404s), install fails.
2. **Waiting** — "the new service worker waits to activate until the old service worker no longer
   controls any clients" (web.dev). This guarantees only one version runs at a time.
3. **Activate** — fires when it is safe to retire the old version; the place to delete old caches
   (MDN). `self.clients.claim()` makes the new worker control already-open pages immediately
   (used in our example so the first visit is controlled without a reload).
4. **Idle/terminated** — the browser stops idle workers and restarts them for events. Chrome is
   likely to stop a worker idle for 30 s, running sync JS for 30 s, or with a `waitUntil()` promise
   unsettled for > 5 min (MDN Offline and background operation).

## How updates are detected (web.dev "Update")
- The browser compares the SW script (and its imported scripts) **byte-by-byte** with the
  installed one. Any change → new worker installs and enters *waiting*.
- Checks happen when the SW wakes up, after a page load in the PWA's window, and when background
  events fire (push, sync). Scripts can force one with `registration.update()`.
- Because only bytes matter, bump `const VERSION = 'vN'` in `sw.js` whenever any app-shell file
  changes; otherwise users keep the old cached shell.
- web.dev's update page does not state the 24-hour HTTP-cache bypass for the SW script — (unconfirmed) on these pages.

## skipWaiting — only after the user agrees
- `self.skipWaiting()` lets the new worker activate immediately. web.dev: "Even though it is not
  recommended, the new service worker can skip that waiting period". Risk: an old page running
  against new SW/caches.
- Flood Watch pattern (CLAUDE skill `pwa-manifest-service-worker`; verified in `../examples/`):
  1. Page watches `registration.updatefound` → `installing.statechange`; when state is
     `installed` **and** `navigator.serviceWorker.controller` exists, it is an update (not a first
     install) → show "Update available — Reload".
  2. On tap: `waiting.postMessage({ type: 'SKIP_WAITING' })`; SW calls `self.skipWaiting()`.
  3. Page listens for `controllerchange` and reloads **once** (guard flag to avoid loops).
  4. `activate` in the new SW deletes `shell-v<old>`.
- Also check `registration.waiting` on page load: a worker may already be waiting from an earlier visit.
- How to tell users (web.dev): an in-page notice (our banner), Notifications API, or the Badging API.

## Updating manifest metadata (web.dev "Update")
Changing `name`, icons or `start_url` does **not** reach users instantly:
- iOS/iPadOS Safari and most Android browsers: only by **re-installing** the app.
- Chrome Android WebAPK: updated by an algorithm when the user opens the app; if the PWA is never
  opened, it is never updated. If the manifest 404s, Chrome will not check again for **≥ 30 days**.
- Samsung Internet WebAPK: if an update is needed, it is minted and applied "during the next 24 hours" on Wi-Fi.
- Chrome/Edge desktop: on launch, re-check if not checked since browser start or in the last
  24 hours; applied after all app windows close.
→ Choose name and icons carefully before launch; treat them as near-permanent.

## Example (runnable): `../examples/app/sw.js` + `app.js`
Verified 2026-11-26 by `node verify.mjs`: SW controls the page after `clients.claim()`; changing
`VERSION` to `v2` and calling `registration.update()` shows the banner; tapping Reload leaves
caches `data-v1, shell-v2` (old `shell-v1` deleted).
