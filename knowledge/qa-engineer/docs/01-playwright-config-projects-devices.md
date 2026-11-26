Source: https://playwright.dev/docs/test-configuration
Source: https://playwright.dev/docs/test-projects
Source: https://playwright.dev/docs/emulation
Retrieved: 2026-11-26

# Playwright Test: configuration, projects, device emulation

## Config basics (test-configuration)
Test-runner options are **top-level**; browser/context options go in `use: {}`.
| Option | Meaning / default |
|---|---|
| `testDir` | folder with tests, relative to the config |
| `testMatch` / `testIgnore` | default match is `**/*.@(spec|test).?(c|m)[jt]s?(x)` |
| `fullyParallel` | run all tests in all files in parallel |
| `forbidOnly` | fail if `test.only` is left in (set `!!process.env.CI`) |
| `retries` | max retries per test (docs example: `process.env.CI ? 2 : 0`) |
| `workers` | max worker processes; number or `'50%'`; docs example `process.env.CI ? 1 : undefined` |
| `globalTimeout` | cap on the whole run; reporters still write a report |
| `timeout` | per-test timeout, **30 s by default**; includes fixtures and `beforeEach` |
| `expect.timeout` | web-first assertion timeout, **5 s by default** |
| `reporter` | e.g. `'html'`, `'list'`, or `[['list'], ['html', { open: 'never' }]]` |
| `outputDir` | artifacts (screenshots, traces); default `test-results` |
| `globalSetup` / `globalTeardown` | file exporting a single function, run before/after all tests |
| `use.baseURL` | lets tests call `page.goto('/')` |
| `use.trace` | e.g. `'on-first-retry'` (see doc 04) |
| `webServer` | `{ command, url, reuseExistingServer: !process.env.CI }` starts a local server first |

## Projects (test-projects)
- `projects: [{ name, use: { ...devices['Pixel 7'] } }, ...]`. Every test runs once per project.
- Run one: `npx playwright test --project=pixel-7`.
- `dependencies: ['setup']` runs a setup project first (e.g. `testMatch: '**/*.setup.ts'`); a setup
  project can name a teardown project.
- Per-project `testMatch`, `testIgnore`, `retries` let a "Smoke" project differ from the default.

## Device emulation (emulation)
- `devices['<name>']` sets `userAgent`, `viewport`, `deviceScaleFactor`, `isMobile`, `hasTouch`
  and **`defaultBrowserType`**. So `devices['iPhone 15']` runs on **WebKit** and `devices['Pixel 7']`
  on **Chromium** unless `browserName` is overridden.
- Override any field after the spread: `{ ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } }`.
- Other context emulation: `locale`, `timezoneId`, `permissions`, `geolocation`
  (`context.setGeolocation()`), `colorScheme` (`'light' | 'dark' | 'no-preference'`, or
  `page.emulateMedia({ colorScheme })`), `offline: true`, `javaScriptEnabled: false`.
- Library form (no test runner): `browser.newContext({ ...devices['iPhone 13'] })`.

## Flood Watch settings (example: `../examples/playwright.config.js`)
- Projects `pixel-7` (Chromium) and `iphone-15` (WebKit) — matches skill `e2e-pwa-testing`.
- `use.timezoneId: 'America/New_York'` is worth adding for any test that asserts times
  ("Updated 10:05 am") so CI in UTC agrees with South Florida. (Our recommendation.)
- Against a Netlify Deploy Preview: set `BASE_URL`; the config then skips `webServer`.
- In the agent container WebKit is **not installed** (`/opt/pw-browsers` has Chromium only), so the
  example has `FW_IPHONE_ON_CHROMIUM=1` to run the iPhone 15 viewport/UA on Chromium. That is
  emulation of size and UA only — it is **not** a Safari/WebKit result. CI must install WebKit
  (`npx playwright install --with-deps`) for the real iPhone project.

## Gotchas
- Putting runner options (e.g. `retries`) inside `use` silently does nothing.
- `isMobile` support differs by engine; the emulation page we read does not state the Firefox limit
  — (unconfirmed) here. We do not run Firefox projects.
