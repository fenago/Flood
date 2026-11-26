# 05 · Testing and accessibility

## 1. Test layers

| Layer | Tool (suggested) | What it covers |
|---|---|---|
| Unit | Vitest or `node:test` | Flood and beach scoring functions, band thresholds, veto rules, unit conversion, city lookup. Pure functions → table-driven tests. |
| Contract / fixture | Recorded JSON from Open-Meteo, Marine, NOAA, NWS saved in `tests/fixtures/` | Parsing parallel `hourly.time[]` arrays, missing values (`null`), time zones, DST changes. Re-record monthly; a nightly job can call the live APIs once to detect field renames. |
| Function tests | Vitest + mocked `fetch`/SDK, `netlify dev` for local runs | Auth, rate limit responses, budget guard, proposal validation, approve flow. **Never call the real GitHub write API or the real Claude API in CI.** |
| Security tests | Same runner | Allow-list bypass attempts: `../netlify/functions/x.mjs`, `public/../netlify.toml`, `%2e%2e/`, `Public/x.js`, Unicode look-alikes, backslashes, absolute paths, >10 files, oversized content, missing CSRF, expired cookie, replayed approve (second approve must fail), stale `baseSha`. |
| End-to-end | Playwright (Chromium + WebKit, phone viewports such as `devices['iPhone 15']`, `devices['Pixel 7']`) | Pick city → outlook renders; offline mode shows cached data with age label; console login, chat (mocked), proposal diff, approve (mocked GitHub). |
| PWA checks | Playwright + Chrome DevTools Protocol `Page.getInstallabilityErrors`; manifest lint script | Installability in Chromium, required manifest members, icon sizes, SW controls the page, offline reload works. |
| Performance / a11y / best practices | Lighthouse CI (`--only-categories=performance,accessibility,best-practices,seo`) | Regression budgets on every deploy preview. |
| Manual devices | Real iPhone (Safari, Add to Home Screen) and Android (Chrome install) | Things automation cannot see: iOS install flow, safe areas, push permission prompt, VoiceOver/TalkBack. |

**Installability check pitfall:** with a default (incognito) Playwright context, CDP `Page.getInstallabilityErrors` can return no errors even without a manifest. Use `chromium.launchPersistentContext` with `channel: 'chromium'`, and include a negative control (a page without a manifest must report `no-manifest`). Also: Playwright route mocks keep answering after `setOffline(true)`, so offline tests must make the mock abort; service-worker tests run on Chromium only. See `knowledge/qa-engineer/` and `knowledge/pwa-mobile-engineer/`.

**Lighthouse no longer has a PWA category.** It was removed in Lighthouse 12.0 (April 2024, Chrome 126 DevTools) after Chrome relaxed its installability criteria. Use DevTools → Application → Manifest → *Installability*, or `Page.getInstallabilityErrors` in CI, instead.

### Netlify-specific

- Every PR gets a **Deploy Preview**; run Playwright and Lighthouse CI against the preview URL.
- `netlify dev` runs functions locally with env vars; use a separate test GitHub repo and a dummy `ANTHROPIC_API_KEY` for local integration tests.
- After each approved agent commit, a smoke test (scheduled function or CI on push) hits `/`, `/console`, and `/api/agents` and checks for 200s; if it fails, roll back to the previous deploy.

### Agent evaluations

Keep a small set of scripted console tasks ("raise the wind veto to 35 mph", "add Naples to the city list") with expected proposal outcomes (files touched, allow-list respected, tests still pass). Run them before changing an agent's prompt or model.

## 2. Accessibility (target: WCAG 2.2 AA)

People check flood risk while stressed, on a small screen, sometimes in poor light or bad weather. Accessibility is a safety feature here.

### Content and design

- **Never use colour alone** for risk: every level has a word ("High"), an icon, and a colour. Check text contrast ≥ 4.5:1 (3:1 for large text and UI components), including on the coloured risk badges, in light and dark mode.
- Lead with one plain sentence: "Flood risk tomorrow: High — 4–6 in of rain on already wet ground, high tide at 7:42 pm." Use US units by default, with a toggle.
- Show data age and source on every forecast ("Updated 10:05 am · Open-Meteo, NOAA, NWS").
- Charts (rain by hour, tide curve) need a text summary and a data table alternative.

### Interaction

- Targets at least **24 × 24 CSS px** (WCAG 2.2 SC 2.5.8); aim for 44 × 44 on primary buttons.
- Full keyboard support and visible focus (SC 2.4.11 focus not obscured — watch sticky headers and the iOS home bar).
- City picker: a native `<select>` or an ARIA combobox that follows the APG pattern; search with typeahead.
- Respect `prefers-reduced-motion` (no animated waves) and `prefers-color-scheme`.
- Support zoom to 200 % and text resizing without horizontal scrolling (reflow at 320 px).

### Agent Console specifics

- Streaming chat: put the transcript in a region with `aria-live="polite"`, but announce the **completed** message, not every token (token-by-token announcements are unusable with screen readers). Provide a "Stop generating" button.
- Diff view: label added/removed lines with text (`+`/`−` and "added"/"removed"), not just green/red; offer a unified-diff toggle for screen readers.
- The Approve button must state what it does ("Approve and deploy 2 files to production") and require confirmation.
- Errors (rate-limited, budget reached, stale proposal) appear in an `role="alert"` region with a clear next step.

### Testing accessibility

- Automated: `@axe-core/playwright` in the E2E suite on every page and state (logged out, outlook, offline, console, diff); Lighthouse accessibility score as a regression signal. Automated tools catch only part of WCAG issues.
- Manual: VoiceOver on iPhone, TalkBack on Android, keyboard-only pass on desktop, 200 % zoom check, a sunlight/low-contrast check on a real phone.

## Sources

- Lighthouse after the PWA category removal — https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0 ; https://developer.chrome.com/blog/update-install-criteria
- Chrome DevTools, Debug PWAs — https://developer.chrome.com/docs/devtools/progressive-web-apps
- CDP `Page.getInstallabilityErrors` — https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getInstallabilityErrors
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices (combobox) — https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- axe-core Playwright — https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
- Playwright device emulation — https://playwright.dev/docs/emulation
