---
name: e2e-pwa-testing
description: Run Playwright end-to-end tests of Flood Watch on phone viewports, including offline mode, service worker and installability checks. Use when testing user flows or PWA behaviour on deploy previews.
user-invocable: false
---
# End-to-end and PWA tests

- Playwright projects: Chromium `devices['Pixel 7']`, WebKit `devices['iPhone 15']`; run against the Netlify Deploy Preview URL. Use `--trace off` unless debugging.
- Mock external APIs with `page.route` + fixtures for determinism; one nightly job hits live APIs.
- Flows: pick city → outlook shows level, reasons, alert banner, data age; beach score; units toggle; console login → chat (mocked) → diff → approve (mocked GitHub).
- Offline: load once, `context.setOffline(true)`, reload → cached outlook with "Offline — from N h ago".
- Service worker: page is controlled (`navigator.serviceWorker.controller`), update banner appears after a new deploy.
- Installability (Chromium): CDP `Page.getInstallabilityErrors` returns none; manifest lint checks members and icon sizes. Lighthouse no longer has a PWA category.
- iOS install flow, push and safe areas: manual checklist on a real iPhone each release.
