# qa-engineer — knowledge folder

Reference notes and worked examples for the agent in `.claude/agents/qa-engineer.md`
(end-to-end, PWA, offline, accessibility and installability testing). Notes summarise official
pages with short quotes; anything not confirmed on the cited page is marked "(unconfirmed)".
Observations made by running code here are labelled "observed" with the versions used.

Last verified: 2026-11-26

## docs/
- `docs/01-playwright-config-projects-devices.md` — config options and defaults (30 s test, 5 s expect), projects/dependencies, device descriptors (`defaultBrowserType`!), Flood Watch project setup, WebKit-missing caveat.
- `docs/02-network-mocking-and-offline.md` — `page.route`/`context.route`, fulfill/continue/abort/fetch, exact glob rules, header/redirect caveats, `setOffline` and the "route still answers while offline" gotcha.
- `docs/03-service-workers-in-playwright.md` — Chromium-only SW support, block vs allow, waiting for control, which requests are routable, update-script routing limitation, recipes.
- `docs/04-assertions-autowait-trace-ci.md` — web-first assertions list, soft/poll/toPass, actionability checks and `force`, trace modes and viewer, GitHub Actions shape, deployment-URL testing, sharding.
- `docs/05-accessibility-axe-playwright.md` — `@axe-core/playwright` API, versioning policy, WCAG tags, attaching results, handling known issues, negative control, limits of automation.
- `docs/06-installability-cdp-and-lighthouse.md` — CDP `getInstallabilityErrors`/`getAppManifest`/`getAppId`, how to avoid vacuous passes (full Chromium + persistent profile), manifest lint, Lighthouse 12 categories and CLI flags.

## examples/
- `examples/README.md` — what each example shows, how to run, exact verification command and result, honest limits.
- `examples/playwright.config.js` — Pixel 7 + iPhone 15 projects, CI settings, webServer/BASE_URL.
- `examples/tests/forecast.spec.js` — Open-Meteo mocked with `page.route`; UI, request params, error path.
- `examples/tests/pwa.spec.js` — offline reload with SW + `context.route`; CDP installability with negative control.
- `examples/tests/a11y.spec.js` — axe WCAG A/AA scan with negative control.
- `examples/tests/fixtures.js` — Open-Meteo-shaped fixture data.
- `examples/site/`, `examples/serve.js` — fixture app (page, SW, manifest, icons) and static server.
- `examples/package.json` — pinned test dependencies (installed outside the repo root).
