# PWA examples — what good looks like

One small, runnable app (`app/`) holds three worked examples, plus the tools to serve and verify it.
None of it is production code; copy patterns into `public/` deliberately and keep Flood Watch's
real design tokens, wording and data clients.

| File | Example | Shows |
|---|---|---|
| `app/manifest.webmanifest` + `app/index.html` | **1. Complete manifest and head tags** | stable `id: "/"`, `start_url` with query inside `scope`, `display: standalone`, 192/512 `any` icons + separate 512 `maskable`, `theme-color`, `apple-touch-icon`, `viewport-fit=cover`, attribution and not-official notice |
| `app/sw.js` + `app/app.js` | **2. Minimal versioned service worker** | `shell-<VERSION>` pre-cache (atomic `addAll`), old caches deleted in `activate`, `clients.claim()`, shell cache-first (navigations ignore `?source=pwa`), Open-Meteo/NOAA/NWS network-first with an `X-Fetched-At` stamp (+ `Access-Control-Expose-Headers` so the page can read it), `/api/*` and `/console*` never intercepted, user-approved `SKIP_WAITING` update banner |
| `app/install.js` + `app/app.css` | **3. Install button + iOS sheet** | `beforeinstallprompt` → `preventDefault()` → own button → `prompt()` once → hide; `appinstalled`; one-time dismissible iOS "Share → Add to Home Screen" sheet; nothing shown in `display-mode: standalone`; safe-area padding; 44 px targets |
| `make-icons.mjs` | helper | writes the 4 PNG icons with Node's zlib (maskable art inside the 40 % safe zone) |
| `serve.mjs` | helper | tiny static server: `application/manifest+json`, `sw.js` with `Cache-Control: no-cache`, can rewrite the SW `VERSION` to simulate a deploy |
| `verify.mjs` | test | Playwright (Chromium) checks listed below |
| `package.json` | docs | scripts and the one dev dependency (`playwright`) |

## Run
```bash
cd knowledge/pwa-mobile-engineer/examples
node make-icons.mjs     # only if icons are missing
node serve.mjs 4173     # manual look at http://localhost:4173
node verify.mjs         # automated checks (needs `playwright`; no external network: APIs are mocked)
```

## What verify.mjs checks
1. Full Chromium (`channel: 'chromium'`, persistent profile): CDP `Page.getInstallabilityErrors` is `[]`,
   and a **negative control** (manifest link removed) reports `no-manifest` — proves the check is not vacuous.
2. Manifest served as `application/manifest+json`; CDP `Page.getAppManifest` has no parse errors.
3. Pixel 7 context: SW controls the page; Open-Meteo is mocked with `context.route` (the SW's own fetch
   is only visible to the context, not `page.route`); rain total renders with `null` treated as 0.
4. `context.setOffline(true)` + reload: shell from cache, cached rain value, "Offline — forecast from N min ago".
5. Simulated deploy (`VERSION` → `v2`) + `registration.update()`: update banner; Reload → caches `data-v1, shell-v2`.
6. Synthetic `beforeinstallprompt`: button appears, `prompt()` outcome recorded, button hidden.
7. iPhone 15 descriptor (UA/viewport on Chromium): iOS sheet shown once, stays dismissed after reload.

## Lessons found while verifying (also recorded in the docs)
- A cross-origin `fetch()` cannot read a custom header from a SW-synthesised response unless it is listed in
  `Access-Control-Expose-Headers`.
- Playwright `context.route` handlers keep fulfilling requests while `context.setOffline(true)` is on, so the
  mock must abort on purpose to simulate offline.
- Default `chromium.launch()` (headless shell) returned `[]` from `Page.getInstallabilityErrors` even with no
  manifest; use full Chromium + a persistent profile (an incognito `newContext()` adds `in-incognito`).

## Not covered (needs a real device)
iOS Add to Home Screen, real install dialogs, notch/home-indicator safe areas, push permission prompts.

Verified: 2026-11-26 — `cd /home/user/Flood/knowledge/pwa-mobile-engineer/examples && node make-icons.mjs && node verify.mjs`
(Node v22.23.5, Playwright 1.63.0, Chromium build 1243). Output: 18 `PASS` lines, 0 `FAIL`, ending "All checks passed"
(installability `[]`, negative control `["no-manifest"]`, offline status "Offline — forecast from 0 min ago. Check NWS
for current alerts.", caches after update `data-v1,shell-v2`).
