# QA examples — a small, honest Playwright suite

A self-contained fixture site plus a Playwright Test suite that shows the patterns Flood Watch's
real `tests/e2e/` should follow. Nothing here calls a real API: Open-Meteo is mocked.

| File | Example | Shows |
|---|---|---|
| `playwright.config.js` | **1. Config with phone projects** | `pixel-7` (Chromium) + `iphone-15` (WebKit) via `devices[...]`; CI-aware `forbidOnly/retries/workers/reporter`; `trace: 'on-first-retry'`; `webServer` locally, `BASE_URL` for a Deploy Preview; `FW_IPHONE_ON_CHROMIUM=1` escape hatch when WebKit is not installed |
| `tests/forecast.spec.js` | **2. Mocking Open-Meteo with `page.route`** | `route.fulfill({ json })`, asserting the request's query params, `waitForRequest` on a city change, 500 → `role="alert"`, `null` in hourly arrays; SW blocked so `page.route` sees everything |
| `tests/pwa.spec.js` | **3. Offline + installability** (Chromium only) | `context.route` (sees the SW's fetch), mock that aborts while `setOffline(true)`, offline reload shows cached data + age; CDP `Page.getInstallabilityErrors` in full Chromium with a persistent profile, plus a negative control expecting `no-manifest` |
| `tests/a11y.spec.js` | **4. axe check** | `@axe-core/playwright` `withTags([...wcag2a/aa, 21a/aa, 22aa])`, results attached to the report, `violations` must equal `[]`; negative control proves the scan catches a removed label (`select-name`) |
| `tests/fixtures.js` | data | Open-Meteo-shaped JSON (parallel `hourly` arrays, one `null`) and the URL glob |
| `site/` + `serve.js` | fixture app | tiny page + `sw.js` (shell cache-first, data network-first with `X-Fetched-At`) + manifest + icons |
| `package.json` | deps | `@playwright/test@1.63.0`, `@axe-core/playwright@4.14.1` (install them **outside** the repo root) |

## Run
```bash
# deps live outside the repo (rule: no node_modules at the repo root)
W2=/tmp/<scratch>/w2 && mkdir -p $W2 && (cd $W2 && npm init -y && npm i @playwright/test@1.63.0 @axe-core/playwright@4.14.1)
cd knowledge/qa-engineer/examples
NODE_PATH=$W2/node_modules FW_IPHONE_ON_CHROMIUM=1 \
  $W2/node_modules/.bin/playwright test --trace off --output $W2/test-results
```
Files are CommonJS so `NODE_PATH` can resolve the packages. In a normal project just
`npm ci && npx playwright install --with-deps && npx playwright test` (and drop `FW_IPHONE_ON_CHROMIUM`).

## Honest limits
- WebKit is not installed in the agent container (`Executable doesn't exist at /opt/pw-browsers/webkit-2359/pw_run.sh`).
  The `iphone-15` project therefore ran with the iPhone 15 viewport/UA/touch on **Chromium**. That is not
  evidence about Safari. CI with WebKit installed must run it for real, and `pwa.spec.js` will (correctly)
  skip on WebKit because Playwright supports service workers and CDP only in Chromium.
- iOS install, safe areas, VoiceOver/TalkBack remain manual (skills `accessibility-testing`, `ios-android-pwa-behavior`).

Verified: 2026-11-26 — from `/home/user/Flood/knowledge/qa-engineer/examples`:
`NODE_PATH=$W2/node_modules FW_IPHONE_ON_CHROMIUM=1 $W2/node_modules/.bin/playwright test --trace off --output $W2/test-results`
(W2 = scratchpad dir with `@playwright/test@1.63.0`, `@axe-core/playwright@4.14.1`, `axe-core@4.14.1`; Node v22.23.5).
Output: "Running 16 tests using 2 workers … 16 passed (4.2s)" — 8 tests × 2 projects (forecast ×3, pwa ×3, a11y ×2).
Without `FW_IPHONE_ON_CHROMIUM` the iphone-15 project fails to launch (WebKit missing), as expected here.
