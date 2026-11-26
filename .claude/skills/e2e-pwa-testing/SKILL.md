---
name: e2e-pwa-testing
description: Run Playwright end-to-end tests of Flood Watch on phone viewports, including offline mode, service worker and installability checks. Use when testing user flows or PWA behaviour on deploy previews.
user-invocable: false
---
# End-to-end and PWA tests

Worked examples: `knowledge/qa-engineer/examples/tests/pwa.spec.js`, `knowledge/pwa-mobile-engineer/examples/verify.mjs` (see both READMEs).

- Playwright projects: Chromium `devices['Pixel 7']`, WebKit `devices['iPhone 15']`; run against the Netlify Deploy Preview URL. Use `--trace off` unless debugging.
- Mock external APIs with `page.route` + fixtures for determinism (use `context.route` when the service worker makes the fetch); one nightly job hits live APIs.
- Flows: pick city → outlook shows level, reasons, alert banner, data age; beach score; units toggle; console login → chat (mocked) → diff → approve (mocked GitHub).
- Offline: load once, `context.setOffline(true)`, reload → cached outlook with "Offline — from N h ago". Route mocks keep answering after `setOffline(true)`, so the mock must `route.abort()` while offline to simulate it.
- Service worker: page is controlled (`navigator.serviceWorker.controller`), update banner appears after a new deploy. Playwright supports service workers in Chromium only - skip SW and CDP tests on WebKit.
- If the page reads a SW-added `X-Fetched-At` header on a cross-origin response, the SW must list it in `Access-Control-Expose-Headers`.
- Installability (Chromium): CDP `Page.getInstallabilityErrors` returns none. A default `chromium.launch()`/incognito context gives false passes - use `chromium.launchPersistentContext(dir, { channel: 'chromium' })`, and include a negative control (page without manifest must report `no-manifest`). Manifest lint checks members and icon sizes. Lighthouse no longer has a PWA category.
- iOS install flow, push and safe areas: manual checklist on a real iPhone each release.
