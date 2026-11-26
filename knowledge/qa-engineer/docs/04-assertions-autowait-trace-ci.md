Source: https://playwright.dev/docs/test-assertions
Source: https://playwright.dev/docs/actionability
Source: https://playwright.dev/docs/trace-viewer
Source: https://playwright.dev/docs/ci
Retrieved: 2026-11-26

# Assertions, auto-waiting, traces and CI

## Web-first (auto-retrying) assertions
They re-query the element and retry until pass or the expect timeout (**5 s default**). Prefer them
over reading a value and comparing (non-retrying `expect(value)` can flake on async UI).
Locator: `toBeAttached, toBeChecked, toBeDisabled, toBeEditable, toBeEmpty, toBeEnabled, toBeFocused,
toBeHidden, toBeInViewport, toBeVisible, toContainText, toContainClass, toHaveAccessibleDescription,
toHaveAccessibleName, toHaveAttribute, toHaveClass, toHaveCount, toHaveCSS, toHaveId,
toHaveJSProperty, toHaveRole, toHaveScreenshot, toHaveText, toHaveValue, toHaveValues,
toMatchAriaSnapshot`. Page: `toHaveTitle, toHaveURL, toHaveScreenshot, toMatchAriaSnapshot`.
API response: `toBeOK`.

Modifiers:
- `.not` — `await expect(locator).not.toContainText('x')`.
- Custom message — `await expect(page.getByText('Name'), 'should be logged in').toBeVisible()`.
- `expect.soft(...)` — record failure, keep running the test.
- `expect.poll(fn, { message, timeout })` — retry any async value (poll default 5 s; `0` = no timeout).
- `await expect(async () => { ... }).toPass()` — retry a whole block.

Flood Watch examples:
```js
await expect(page.getByRole('status')).toHaveText(/^Offline — forecast from \d+ (min|h) ago/);
await expect(page.getByRole('alert')).toHaveText(/Forecast unavailable/);
await expect(page.getByRole('button', { name: /Approve and deploy 2 files/ })).toBeEnabled();
```
Prefer role/label locators (`getByRole`, `getByLabel`) — they double as accessibility checks.

## Auto-waiting (actionability)
Before acting, Playwright waits for the element to be:
| Check | Definition | Used by |
|---|---|---|
| Visible | non-empty bounding box, not `visibility:hidden` | click, tap, check, hover, fill, selectOption, screenshot… |
| Stable | same bounding box for ≥ 2 consecutive animation frames | click, tap, check, hover, dragTo, screenshot, scrollIntoViewIfNeeded |
| Receives events | is the hit target at the action point (no overlay on top) | click, tap, check, hover, dragTo |
| Enabled | not `[disabled]` (button/select/input/textarea/option/optgroup or disabled fieldset) and not under `[aria-disabled=true]` | click, check, fill, clear, selectOption |
| Editable | enabled and not `[readonly]` / `aria-readonly=true` | fill, clear |
- `force: true` skips non-essential checks — **don't** use it to get green; an overlay blocking a
  click (e.g. update banner over the Approve button) is a real bug.
- Glass/animated surfaces: "Stable" waits for animations to settle; respect `prefers-reduced-motion`
  by emulating it if animations slow tests (`page.emulateMedia({ reducedMotion: 'reduce' })` —
  option name not re-checked on these pages, (unconfirmed)).

## Traces
`use.trace` / CLI `--trace`: `'off'`, `'on'` ("performance heavy", not recommended),
`'retain-on-failure'`, `'on-first-retry'` (record only on the first retry), `'on-all-retries'`.
A trace holds a screencast film strip, DOM snapshots before/action/after each step, action log,
source location, console, network, metadata, attachments.
Open: `npx playwright show-trace path/to/trace.zip` or upload to trace.playwright.dev.
Team rule (skill `e2e-pwa-testing`): run with `--trace off` locally and in agent runs; CI keeps
`on-first-retry` so failures come with evidence.

## CI (GitHub Actions shape from the docs)
```yaml
- uses: actions/checkout@v6
- uses: actions/setup-node@v6
  with: { node-version: lts/* }
- run: npm ci
- run: npx playwright install --with-deps
- run: npx playwright test
- uses: actions/upload-artifact@v5
  if: ${{ !cancelled() }}
  with: { name: playwright-report, path: playwright-report/, retention-days: 30 }
```
- `workers: 1` on CI "to prioritize stability and reproducibility".
- Test a deployment: trigger `on: deployment_status`, guard
  `if: github.event.deployment_status.state == 'success'`, pass
  `PLAYWRIGHT_TEST_BASE_URL: ${{ github.event.deployment_status.target_url }}` (our config reads
  `BASE_URL`; map one to the other). Netlify Deploy Previews post deployment statuses to GitHub
  (our assumption from Netlify's GitHub integration — (unconfirmed) here).
- Docker image example: `mcr.microsoft.com/playwright:v1.64.1-noble` (pin to the same version as `@playwright/test`).
- Sharding: `npx playwright test --shard=1/4`.
- Caching browser binaries is **not recommended** (restore time ≈ download time; OS deps can't be cached).
- `.github/` is a denied path for agent proposals (CLAUDE.md fixed decision 5): workflow changes go
  through a human, not through the Agent Console.
