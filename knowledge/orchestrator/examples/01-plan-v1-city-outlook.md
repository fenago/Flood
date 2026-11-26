# Example 1 - Worked plan: "Ship v1 city outlook"

Machine-checked plan: [`01-plan-v1-city-outlook.json`](01-plan-v1-city-outlook.json). Validate with:

```bash
node knowledge/orchestrator/examples/check-plan.mjs knowledge/orchestrator/examples/01-plan-v1-city-outlook.json
# -> VALID: 11 tasks, 5 waves, 0 warning(s)
```

## Goal (one sentence)

A user picks a South Florida city and sees the flood prognosis with reasons and the beach-day score, installable and usable offline with data age shown.

## Waves

| Wave | Tasks launched together (one Agent call each, in one message) | Why this wave |
|---|---|---|
| 1 | T1 `software-architect` contracts; T2 `ux-designer-apple-hig` flow + wording; T3 `ui-designer-apple-liquid-glass` tokens | No dependencies. The contract is first so both sides can be built in parallel next. |
| 2 | T4 `api-integration-open-meteo` clients; T5 `flood-risk-scientist` scoring; T6 `pwa-mobile-engineer` shell/UI; T7 `netlify-engineer` CSP | All need only T1 (T6 also T2, T3). No two tasks touch the same file. |
| 3 | T8 `pwa-mobile-engineer` wiring; T9 `security-engineer` review of T7 | T8 needs T4-T6; T9 needs T7. Independent of each other. |
| 4 | T10 `qa-engineer` tests on deploy preview | Needs the built candidate (T8) and the reviewed config (T9). |
| 5 | T11 `orchestrator` release sign-off | Needs QA evidence. |

```
T1 ─┬─> T4 ─┐
    ├─> T5 ─┼─> T8 ─┐
T2 ─┼─> T6 ─┘       ├─> T10 ─> T11
T3 ─┘               │
T1 ───> T7 ─> T9 ───┘
```

Design choices worth copying:
- **Contract first, then both sides in parallel** (T1 then T4/T5/T6). Multi-agent coding works when tasks touch separate files; the contract removes the need for experts to talk.
- **T6 builds against fake contract-shaped data** so the UI does not wait for T4/T5.
- **Security review is its own task** after the `netlify.toml` change (T7 -> T9), as CLAUDE.md requires.
- **Same owner in two waves is fine** (T6, T8). Resume T6's agent for T8 if its context is still useful; otherwise launch fresh with T6's report pasted in.

## Briefs as sent (wave 1)

The orchestrator sends all three in **one message**. Each is self-contained because the subagent starts with a fresh context and sees none of this conversation.

### To `software-architect` (T1)

```
Task T1 - Define v1 outlook module contracts.
Goal: Write docs/contracts/outlook.md: the functions and JSON shapes between
src/api (Open-Meteo forecast+marine, NOAA tides, NWS alerts), src/scoring
(scoreFlood, scoreBeach) and src/ui. Include missing-data rules (null = missing,
never 0), cache keys and fetchedAt, and the exact hosts the browser calls.
Read first: CLAUDE.md, docs/01-use-case-and-scoring.md, docs/03-architecture.md.
You own: docs/contracts/outlook.md; new entries in docs/decisions.md.
Do not edit: src/, public/, netlify/ (other experts build from your spec next).
Acceptance: an API expert and a scoring expert can each build their side from
the file alone; no server, database or browser secret is introduced.
Return: your standard report (Result / Checks / Handoff / Risks). In Handoff,
list anything the UX or UI designers must change to match the contract.
```

### To `ux-designer-apple-hig` (T2)

```
Task T2 - City picker and outlook flow and wording.
Goal: Define screens and states (loading, fresh, stale, offline, NWS alert
override, error) and every user-facing string, in docs/design/outlook-flow.md.
Read first: CLAUDE.md, docs/01-use-case-and-scoring.md (levels, beach score),
docs/05-testing-and-accessibility.md.
You own: docs/design/outlook-flow.md only.
Must keep: the "not an official warning; follow NWS" notice and the
"Weather data by Open-Meteo.com" credit on the outlook screen.
Acceptance: each state has wording; WCAG 2.2 AA notes per screen.
Return: standard report. Put token or contrast needs for Sable in Handoff.
```

### To `ui-designer-apple-liquid-glass` (T3)

```
Task T3 - Risk-level and surface design tokens.
Goal: CSS custom properties in src/ui/tokens.css for flood levels
(Low/Elevated/High/Severe), beach score bands, glass surfaces with solid
fallbacks, light and dark themes.
Read first: CLAUDE.md, docs/05-testing-and-accessibility.md.
You own: src/ui/tokens.css only.
Acceptance: text contrast >= 4.5:1 in both themes; level is never shown by
colour alone (define the label/icon pairing tokens).
Return: standard report with a contrast table in Checks.
```

## What the orchestrator does between waves

1. Wait for **all** wave-1 completion notifications.
2. Read each Handoff section; add or adjust wave-2 tasks (see example 2).
3. Paste the contract path and any decisions into the wave-2 briefs.
4. Re-run `check-plan.mjs` after editing the plan; launch wave 2 in one message.
