Source: https://playwright.dev/docs/network
Source: https://playwright.dev/docs/api/class-browsercontext
Retrieved: 2026-11-26

# Network mocking (`page.route`) and offline (`context.setOffline`)

## Why we mock
CI must be deterministic and must not depend on Open-Meteo/NOAA/NWS uptime (Open-Meteo is free
and non-commercial; don't hammer it). Fixtures go in `tests/fixtures/`; one nightly job may hit the
live APIs to detect field renames (our `docs/05`).

## Routing API
- `page.route(url, handler)` — this page only. `context.route(url, handler, { times })` — every page
  in the context **and** service-worker requests (doc 03). Returns a Disposable.
- "Once route is enabled, every request matching the url pattern will stall unless it's continued,
  fulfilled or aborted." Always end the handler with one of:
  - `route.fulfill({ status, contentType, body, json, path, headers, response })`
  - `route.continue({ headers, method })` (the two overrides shown on the page)
  - `route.abort(errorCode?)` — `'internetdisconnected'` used and working in our examples; full code list is on the Route API page (not re-read here)
  - `route.fetch()` → real response you can modify, then `route.fulfill({ response, body, headers })`.
- `page.routeFromHAR()` replays recorded traffic (listed on the page; not used by us yet).
- Waiting: `const p = page.waitForResponse('**/v1/forecast**'); await action; const res = await p;`
  (start waiting **before** the action; also accepts RegExp or predicate). Same for `waitForRequest`.

## URL glob rules (exact, from the docs)
- `*` = any chars except `/`; `**` = any chars including `/`.
- `?` matches a **literal `?`** only (not "any char").
- `{a,b}` = alternatives; `\` escapes.
- The glob must match the **entire URL** (protocol included). For Open-Meteo with a query use
  `'https://api.open-meteo.com/v1/forecast?**'` or a RegExp such as `/api\.open-meteo\.com\/v1\/forecast/`.

## Caveats from the docs
- Headers owned by the network stack (`Cookie`, `Host`, `Accept-Encoding`, `Content-Length`,
  `Sec-Fetch-*`) are not reliably visible and cannot be overridden; a `cookie` header passed to
  `route.continue()` is ignored.
- Redirect chains are one unit: the handler runs once for the original request.
- `context.route()` "will not intercept requests intercepted by Service Worker"; the API docs
  recommend `serviceWorkers: 'block'` when using request interception. Tools like MSW install
  their own SW, which hides requests from `route()`.

## Asserting what was requested
```js
const seen = [];
await page.route('https://api.open-meteo.com/v1/forecast?**', route => {
  seen.push(new URL(route.request().url()));
  return route.fulfill({ json: FORECAST });
});
// ... after load:
expect(seen[0].searchParams.get('timezone')).toBe('America/New_York');
```
Checking query params protects exact field names (`hourly=precipitation`, etc.) — see skill
`open-meteo-apis` for the authoritative list.

## Offline
- `browserContext.setOffline(offline: boolean)` emulates the network being offline for the context
  (added before v1.9). Config equivalent: `use: { offline: true }`.
- **Observed 2026-11-26 (Playwright 1.63, Chromium):** an active `context.route` handler still
  fulfils matching requests while offline — the mock wins. To simulate "API unreachable", make the
  handler abort when a flag is set:
  ```js
  let offline = false;
  await context.route(OPEN_METEO, r => offline ? r.abort('internetdisconnected') : r.fulfill({ json: FORECAST }));
  offline = true; await context.setOffline(true); await page.reload();
  ```
- In the same run `navigator.onLine` was `false` in the page after `setOffline(true)`.
- Offline test recipe (skill `e2e-pwa-testing`): load online → wait for SW control → reload so the
  SW caches data → go offline → reload → expect cached outlook + "Offline — forecast from N … ago".

## Error-path tests we always include
- 500 from the API → `role="alert"` message, no stale number shown as current.
- `null` values inside hourly arrays (Open-Meteo sends them) → treated as missing, not as 0 risk —
  check against the scoring rules in skill `flood-prognosis-model`.
