Source: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
Source: https://playwright.dev/docs/accessibility-testing
Retrieved: 2026-11-26

# Automated accessibility with `@axe-core/playwright`

## Package facts (README, develop branch; latest commit "RC v4.14.1", 2026-11-19)
- Install: `npm install playwright` and `npm install @axe-core/playwright` (for the test runner,
  also `@playwright/test`). Installed and run here: `@axe-core/playwright@4.14.1` with `axe-core@4.14.1`.
- **Not SemVer**: the package's major.minor track the axe-core it bundles (API v4.7.2 → axe-core
  4.7.x); patch versions may add features/fixes but no breaking changes. Pin exact versions and
  review the changelog on upgrade — rule changes can surface new violations.
- Automatically injects into all frames. Recent fix (PR #1478, Oct 2026): frames that cannot run
  scripts (sandboxed without `allow-scripts`, CSP `sandbox`) are skipped instead of hanging and are
  reported as `incomplete` under rule `frame-tested`; `analyze()` on a page with JavaScript
  disabled now throws "Frame cannot run scripts".
- Import: `const { AxeBuilder } = require('@axe-core/playwright');` (ESM: `import AxeBuilder from` is
  shown in Playwright's guide (unconfirmed exact form); CJS named export is what we ran).

## AxeBuilder API (chainable)
| Method | Effect |
|---|---|
| `new AxeBuilder({ page })` | bind to a Playwright Page |
| `.analyze()` | run; resolves to axe results (`violations`, `passes`, `incomplete`, `inapplicable`) |
| `.include(selector)` / `.exclude(selector)` | scope; chain calls — arrays with >1 entry are **not** supported |
| `.withTags(tag \| tags[])` | only rules with these tags |
| `.withRules(id \| ids[])` | only these rule ids |
| `.disableRules(id \| ids[])` | skip rules |
| `.options(axe.RunOptions)` | raw `axe.run` options; overrides `withRules`/`withTags` |
| `.setLegacyMode(bool)` | last resort pre-4.3 frame mode (cross-origin frames untested) |

## Playwright guide patterns
```js
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();
expect(results.violations).toEqual([]);
```
- Scan after the state is ready (await a web-first assertion first), and scan each **state**, not
  just each URL (skill `accessibility-testing`: first run, each risk level, beach, offline banner,
  error, console login, chat, diff, confirmation sheet).
- Attach results for evidence: `await testInfo.attach('accessibility-scan-results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' })`.
- Known issues: prefer a narrow `.exclude('#element')` or `.disableRules([...])` with a tracking
  issue, or snapshot violation **fingerprints** (`rule` + `targets`) with `toMatchSnapshot()` so new
  violations still fail. Never blanket-disable to get green (CLAUDE.md working rules).
- Share config through a fixture (`test.extend({ makeAxeBuilder })`) so every spec uses the same tags.
- Disclaimer (Playwright): automated tests detect some common problems; many issues "can only be
  discovered through manual testing" → VoiceOver/TalkBack/keyboard/zoom passes remain required.

## Tags for Flood Watch (target WCAG 2.2 AA)
We pass `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']`. The first four are from the
Playwright guide; `wcag22aa` is an axe-core tag name we used successfully with axe-core 4.14.1, but
it is not listed on the two pages read — (unconfirmed) against axe-core's rule docs.
Release gate (skill `accessibility-testing`): zero serious/critical violations; we assert zero violations of any impact on fixture pages.

## Not vacuous — negative control
On 2026-11-26 the same scan against the example fixture with its `<label for="city">` removed
reported `select-name (critical)`; with the label present it reported none. Keep one such control
whenever the scan setup changes.

## Mapping to WCAG 2.2 items axe cannot fully judge
Target size 24×24 (SC 2.5.8), focus not obscured by sticky banners (SC 2.4.11), meaningful
reading order of risk explanations, and "colour is not the only signal" for risk levels need manual
or custom checks (our `docs/05`).
