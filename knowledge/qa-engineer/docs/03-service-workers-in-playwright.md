Source: https://playwright.dev/docs/service-workers
Source: https://playwright.dev/docs/api/class-browsercontext
Retrieved: 2026-11-26

# Service workers in Playwright

## Support
- "Service workers are only supported on Chromium-based browsers" (Playwright docs). So SW,
  offline-reload and update-banner tests run in the **Pixel 7 (Chromium)** project only:
  ```js
  test.skip(({ browserName }) => browserName !== 'chromium', 'SW + CDP need Chromium');
  ```
  The iPhone 15 (WebKit) project cannot prove offline behaviour → real-iPhone manual check.

## Two modes
1. **Block** them for pure UI tests: `use: { serviceWorkers: 'block' }` (or `test.use(...)` per
   file). Faster, deterministic, and `page.route` sees every request. Behaviour may differ from
   production, so keep a separate SW suite.
2. **Allow** them (the default when `serviceWorkers` is not set; the literal value `'allow'` is (unconfirmed) on the pages read) for PWA tests — then route with `context.route`, not `page.route`.

## Waiting for the worker
- `context.waitForEvent('serviceworker')` / `context.on('serviceworker')` fire when a worker is
  **created**, i.e. *before* it controls the page. `context.serviceWorkers()` lists existing ones
  (both added in v1.11).
- Implementation-agnostic wait from the docs:
  ```js
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg.active?.state === 'activated') return;
    await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r));
  });
  ```
- For "SW controls the page" we use
  `await page.waitForFunction(() => navigator.serviceWorker.controller !== null)`;
  this needs the SW to call `clients.claim()` on first install (it does in our examples).

## Which requests can be routed
From the docs' table for a pass-through SW (page fetches `data.json`):
| Request | Owner | Routable by `context.route` | `response.fromServiceWorker()` |
|---|---|---|---|
| `index.html` (navigation before SW) | Frame | yes | |
| SW script itself | Service Worker | yes | |
| `data.json` fetched **by the SW** | Service Worker | yes | |
| `data.json` as the page sees it | Frame | **no** | `true` |
- `request.serviceWorker()` returns the Worker for SW-owned requests; calling `request.frame()` on
  them **throws**.
- Route only SW traffic: `if (route.request().serviceWorker()) { ... }`.
- Practical rule for Flood Watch: with the SW allowed, mock Open-Meteo with `context.route` — the
  SW's network-first `fetch()` is the request that reaches the mock (verified in both examples:
  2 routed calls, page-owned then SW-owned).
- Known limitation: requests for an **updated SW main script** cannot be routed
  (github.com/microsoft/playwright/issues/14711). To test the update banner, change what the server
  returns for `/sw.js` instead (the pwa-mobile-engineer example server can rewrite `VERSION`).

## Test recipes
- **Controls page:** goto → `waitForFunction(controller !== null)`.
- **Offline reload:** see doc 02 (route must abort while offline).
- **Update banner:** serve a byte-different `sw.js` → `page.evaluate(() => reg.update())` →
  expect banner visible → click Reload → `caches.keys()` contains only the new `shell-vN`.
- **Never cached:** after a session, `caches.open('data-v1')` must hold no `/api/*` or `/console*` URL.
- **Fresh state:** each Playwright test gets a new context, so no SW/caches leak between tests;
  persistent contexts (doc 06) need their own temp profile per test (`testInfo.outputPath()`).
