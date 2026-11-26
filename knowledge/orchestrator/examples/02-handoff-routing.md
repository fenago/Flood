# Example 2 - Routing handoffs into the next wave

Context: wave 2 of the v1 city outlook plan has finished. Three of the reports are below (trimmed to the parts that matter). Experts cannot call each other, so every "to <agent>" line becomes a task the orchestrator creates.

## Report A - `api-integration-open-meteo` (T4)

```
## Result
- src/api/open-meteo.js, src/api/noaa-tides.js, src/api/nws-alerts.js, src/api/cache.js
- Fixtures in tests/fixtures/api/ (Miami Beach, Fort Lauderdale, 2026-11-20)
## Checks
- node --test tests/api: 18 passed
## Handoff
- to flood-risk-scientist: Marine sea_level_height_msl is null for Hollywood
  (inland cell). Scoring must treat it as missing; fixture
  tests/fixtures/api/marine-hollywood-null.json shows it.
- to netlify-engineer: NWS needs https://api.weather.gov in connect-src
  (already listed in T7?) - please confirm.
## Risks / open questions
- NWS asks for a User-Agent; browsers cannot set it. Owner decision?
```

## Report B - `flood-risk-scientist` (T5)

```
## Result
- src/scoring/flood.js, src/scoring/beach.js, public/config/scoring.json
## Checks
- 42 table tests passed
## Handoff
- to ux-designer-apple-hig: new reason code "tide-data-missing" needs
  user wording.
- to qa-engineer: add a fixture case where an NWS Coastal Flood Warning
  overrides a computed Low.
## Risks / open questions
- none
```

## Report C - `pwa-mobile-engineer` (T6)

```
## Result
- public/index.html, src/ui/outlook.js, src/ui/picker.js, manifest, sw.js
## Checks
- Manual install on Android Chrome OK; iPhone Add to Home Screen OK
## Handoff
- to ui-designer-apple-liquid-glass: --fw-level-elevated text on glass is
  3.9:1 in dark mode; needs a darker value.
## Risks / open questions
- none
```

## Orchestrator's routing table

| From | Handoff item | Decision | New task |
|---|---|---|---|
| A | sea level null -> scoring treat as missing | Already covered? T5 report does not mention it, so **check, do not assume** | T12 `flood-risk-scientist`: confirm null handling with A's fixture; add a test |
| A | `api.weather.gov` in `connect-src` | T7 diff already lists it (checked the diff) | None - reply in T9 brief so security reviews it |
| A | NWS User-Agent from browser | Owner decision, not an expert task. Fixed decision 2 says the browser calls NWS directly | Add to owner summary as an open question; no task |
| B | wording for `tide-data-missing` | Real gap | T13 `ux-designer-apple-hig`: add the string to docs/design/outlook-flow.md |
| B | alert-override fixture | Belongs in QA's test task | Fold into T10's brief (no separate task) |
| C | contrast 3.9:1 < 4.5:1 | Accessibility failure, blocks release | T14 `ui-designer-apple-liquid-glass`: fix token in src/ui/tokens.css |

Rules applied:
- Every handoff gets an explicit outcome: new task, folded into an existing task, or escalated to the owner. Nothing is dropped silently.
- A handoff that changes a file owned by another wave-3 task must not run in parallel with it. T13 (docs/design) and T14 (src/ui/tokens.css) do not overlap with T8 (`src/main.js`, `src/ui/outlook.js`) or T9, so all four can go in wave 3.
- The new owner gets the **evidence** pasted in (the fixture path, the measured contrast value), not "see report A".

## Updated wave 3 (launched in one message)

| Task | Owner | Depends on | Touches |
|---|---|---|---|
| T8 | `pwa-mobile-engineer` | T4, T5, T6 | `src/main.js`, `src/ui/outlook.js` |
| T9 | `security-engineer` | T7 | - (review; brief notes `api.weather.gov` question) |
| T12 | `flood-risk-scientist` | T4, T5 | `tests/scoring/` |
| T13 | `ux-designer-apple-hig` | T5 | `docs/design/outlook-flow.md` |
| T14 | `ui-designer-apple-liquid-glass` | T6 | `src/ui/tokens.css` |

T10 (`qa-engineer`) now depends on T8, T9, T12, T13, T14, and its brief gains: "include an NWS Coastal Flood Warning over computed Low fixture case (from flood-risk-scientist)". Re-run `check-plan.mjs` after these edits before launching.

## Brief for T14 (example of passing evidence)

```
Task T14 - Fix dark-mode contrast of the Elevated level token.
Evidence: pwa-mobile-engineer measured --fw-level-elevated text on the glass
surface at 3.9:1 in dark mode (needs >= 4.5:1, WCAG 2.2 AA 1.4.3).
You own: src/ui/tokens.css only. Do not change other level colours unless
they also fail; list any you change.
Acceptance: contrast table for all four levels, both themes, all >= 4.5:1.
Return: standard report.
```
