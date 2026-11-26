# Orchestrator examples

Small worked examples of what good orchestration looks like on Flood Watch.

| File | Shows |
|---|---|
| [01-plan-v1-city-outlook.md](01-plan-v1-city-outlook.md) | A goal split into 5 waves, one owner per task, the parallel launches, and the exact wave-1 briefs |
| [01-plan-v1-city-outlook.json](01-plan-v1-city-outlook.json) | The same plan as data, checked by `check-plan.mjs` |
| [02-handoff-routing.md](02-handoff-routing.md) | Three expert reports with Handoff sections turned into the next wave |
| [03-release-signoff.md](03-release-signoff.md) | A filled-in sign-off: first NO-GO with owners, then GO tied to one commit |
| [check-plan.mjs](check-plan.mjs) | Zero-dependency validator for plan files |

## Plan file format

```json
{
  "goal": "one sentence",
  "release": true,
  "acceptance": ["..."],
  "tasks": [{
    "id": "T1", "title": "...", "owner": "software-architect", "wave": 1,
    "dependsOn": [], "touches": ["docs/contracts/outlook.md"],
    "brief": { "goal": "...", "read": [], "owns": [], "acceptance": [], "return": "..." }
  }]
}
```

## Running the checker

```bash
node knowledge/orchestrator/examples/check-plan.mjs <plan.json> [--agents .claude/agents]
```

Rules: unique ids; exactly one owner per task that exists in `.claude/agents` (read from each file's `name:`); known dependencies; no cycles; waves 1..N with every task after its dependencies; no two tasks in one wave touching the same path; sensitive paths (`netlify/`, `netlify.toml`, `.claude/`, `.github/`, `scripts/`, `package*.json`, auth, allow-list, `.env`) followed by a `security-engineer` task; release plans end with an orchestrator sign-off that depends on everything and on a `qa-engineer` task; every brief has goal/read/owns/acceptance/return. Warns when a task sits in a later wave than needed.

Results on 2026-11-26 (Node 22.23.5):
- `01-plan-v1-city-outlook.json` -> `VALID: 11 tasks, 5 waves, 0 warning(s)`, exit 0.
- A deliberately broken copy (cycle, unknown owner, two owners, same-wave file clash) -> 5 errors, exit 1.
- A copy without the security review and with a delayed task -> E7 error + W1 warning, exit 1.
