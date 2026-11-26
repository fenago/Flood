Source: https://chromedevtools.github.io/devtools-protocol/tot/Page/
Source: https://github.com/GoogleChrome/lighthouse/releases/tag/v12.0.0
Source: https://github.com/GoogleChrome/lighthouse/blob/main/readme.md
Source: https://playwright.dev/docs/api/class-browsercontext
Retrieved: 2026-11-26

# Installability via CDP, and Lighthouse without a PWA category

## CDP methods (Page domain, tip-of-tree)
| Method | Status | Returns |
|---|---|---|
| `Page.getInstallabilityErrors` | **experimental** | `installabilityErrors: InstallabilityError[]` |
| `Page.getAppManifest({ manifestId? })` | stable | `url` (manifest location), `errors: AppManifestError[]`, `data` (raw text), `manifest` (exp), `parsed` (deprecated) |
| `Page.getAppId` | experimental | `appId` (from manifest `id` or computed from `start_url`), `recommendedId`, plus IWA/sub-app fields |
- `InstallabilityError = { errorId: string, errorArguments: [{ name, value }] }`, e.g.
  `{ errorId: 'manifest-missing-suitable-icon', errorArguments: [{ name: 'minimum-icon-size-in-pixels', value: '144' }] }`.
- `AppManifestError = { message, critical (1 = non-recoverable parse error), line, column }`.
- Experimental methods can change between Chrome versions: pin the Playwright version and keep the
  negative control below so a silent API change is noticed.

## Getting a CDP session in Playwright
`const cdp = await context.newCDPSession(page);` — "CDP sessions are only supported on
Chromium-based browsers" (added v1.11). Then `await cdp.send('Page.getInstallabilityErrors')`.

## IMPORTANT: how to make the check meaningful (observed 2026-11-26)
Environment: Playwright 1.63.0, Chromium build 1243, page served on `http://localhost`.
| Launch | Good manifest | No manifest link | Empty `icons` |
|---|---|---|---|
| `chromium.launch()` (default **headless shell**) + `newContext()` | `[]` | `[]` (!) | `[]` (!) |
| `chromium.launch({ channel: 'chromium' })` + `newContext()` | `in-incognito` | `in-incognito, no-manifest` | `in-incognito, manifest-missing-suitable-icon, no-acceptable-icon` |
| `chromium.launchPersistentContext(dir, { channel: 'chromium' })` | `[]` | `no-manifest` | (not run) |
So:
- The default headless shell gives a **vacuous pass**. Use full Chromium in new headless mode
  (`channel: 'chromium'`).
- A normal `browser.newContext()` is off-the-record, so `in-incognito` is always present. Use a
  persistent context with a temp profile (`testInfo.outputPath('profile')`), or filter out
  exactly `in-incognito` and nothing else.
- Always pair the positive test with a negative control (manifest link removed → expect
  `no-manifest`). Both are in `../examples/tests/pwa.spec.js`.
- The 144 px minimum in the error argument is what Chromium reported for icons; our policy is still
  192 + 512 (MDN criteria; pwa-mobile-engineer doc 02).

## Manifest lint (complements CDP)
Cheap Node test over `public/manifest.webmanifest`: required members (`name`/`short_name`,
`start_url`, `display`, `icons` with `192x192` and `512x512`, one `maskable`), `id` unchanged from
the recorded value, `prefer_related_applications` not `true`, every icon `src` exists and its PNG
header width/height match `sizes`.

## Lighthouse
- **v12.0.0 (released Apr 22, 2024):** "As per Chrome's updated Installability Criteria, Lighthouse
  has removed the PWA category." Same release removed budgets and the service-worker gatherer.
  Expected to ship in Chrome 126 DevTools.
- Current CLI (readme): `npm install -g lighthouse`, needs **Node 22 (LTS) or later**.
- `--only-categories` — "Available categories: accessibility, best-practices, performance, seo".
  Asking for `pwa` is not an option any more.
- Other flags: `--output json|html|csv` (multiple allowed, default html), `--output-path <file|stdout>`,
  `--preset perf|experimental|desktop`, `--form-factor mobile|desktop`,
  `--screenEmulation.*` (`mobile`, `width=360`, `height=640`, `deviceScaleFactor=2`, or `.disabled`),
  `--chrome-flags "..."` (and `CHROME_PATH` env var), `--quiet`.
- Our CI command (from `docs/05`):
  ```bash
  lighthouse "$PREVIEW_URL" --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path=./lh.json --chrome-flags="--headless=new" --quiet
  ```
  Fail the job on an accessibility score regression; treat performance as a budget signal.
  `--headless=new` is a Chrome flag, not a Lighthouse option — (unconfirmed) on the pages read.

## What replaces the old PWA audits
| Old Lighthouse PWA check | Now |
|---|---|
| installable manifest | CDP `Page.getInstallabilityErrors` + manifest lint |
| SW registered / offline start_url | Playwright: SW controls page; offline reload test (doc 03) |
| themed omnibox, maskable icon | manifest lint; DevTools → Application → Manifest for manual review |
| iOS behaviour | manual real-device checklist (pwa-mobile-engineer doc 05) |
