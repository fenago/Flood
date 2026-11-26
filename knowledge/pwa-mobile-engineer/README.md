# pwa-mobile-engineer — knowledge folder

Reference notes and worked examples for the agent in `.claude/agents/pwa-mobile-engineer.md`
(manifest, service worker, install UI, iPhone/Android behaviour). Notes are summaries of official
pages with short quotes; anything not confirmed on the cited page is marked "(unconfirmed)".

Last verified: 2026-11-26

## docs/
- `docs/01-web-app-manifest.md` — manifest deployment, member list and status, `id` resolution rules, icons `purpose`, `display` fallback chain, our manifest.
- `docs/02-installability-and-install-prompt.md` — Chromium install criteria, SW/fetch-handler history, browser support matrix, `beforeinstallprompt` pattern, where to promote install.
- `docs/03-service-worker-lifecycle-and-updates.md` — scope, install/waiting/activate, byte-diff updates, user-approved `skipWaiting`, how manifest metadata updates on each platform.
- `docs/04-caching-offline-and-background.md` — Cache Storage API, the five strategies and which Flood Watch uses, `fetchedAt` stamping (CORS expose-header gotcha), background sync/fetch/periodic sync/push.
- `docs/05-ios-webkit-home-screen-apps.md` — iOS 16.4 Home Screen apps, no install prompt, detection, Web Push and Badging rules, real-device checklist.
- `docs/06-icons-display-mode-safe-areas.md` — maskable icon safe zone (40 % radius), `display-mode` values, `viewport-fit=cover`, `env()` safe-area/keyboard/titlebar variables.

## examples/
- `examples/README.md` — what each example shows, how to run, the exact verification command and result.
- `examples/app/` — runnable mini app: complete manifest + head tags, versioned `sw.js`, `install.js` (install button + iOS sheet), `app.js`, `app.css`, icons.
- `examples/make-icons.mjs` — dependency-free PNG icon generator.
- `examples/serve.mjs` — tiny static server with correct manifest type and `no-cache` SW.
- `examples/verify.mjs` — Playwright checks: installability (with negative control), SW control, offline reload, update banner, install UI.
- `examples/package.json` — scripts and the single dev dependency.
