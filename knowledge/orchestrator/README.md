# Knowledge: orchestrator

Reference notes and worked examples for the `orchestrator` agent (`.claude/agents/orchestrator.md`). They back its skills `team-orchestration`, `release-signoff`, `docs-upkeep` and `smoke-test-rollback` with facts from official pages.

Last verified: 2026-11-26

## docs/

| File | One line |
|---|---|
| [docs/01-claude-code-subagents.md](docs/01-claude-code-subagents.md) | How subagents get context, run in the background by default, run in parallel (cap 20), nest up to 3 layers, resume, and which frontmatter fields matter |
| [docs/02-session-as-agent-and-parallel-work.md](docs/02-session-as-agent-and-parallel-work.md) | `claude --agent orchestrator`, the `agent` setting, `--agents`, worktrees, agent view and plan mode |
| [docs/03-anthropic-multi-agent-research-system.md](docs/03-anthropic-multi-agent-research-system.md) | Anthropic's orchestrator-worker lessons: brief contents, effort scaling, parallelism, token cost, when multi-agent fits |
| [docs/04-building-effective-agents-patterns.md](docs/04-building-effective-agents-patterns.md) | The five workflow patterns, orchestrator-workers vs parallelization, start simple, checkpoints and stop conditions |
| [docs/05-netlify-release-basics.md](docs/05-netlify-release-basics.md) | Deploy Previews, permalinks, atomic deploys, rollback and locking, what to record at sign-off |

## examples/

| File | One line |
|---|---|
| [examples/README.md](examples/README.md) | Index of the examples, plan file format, checker rules and results |
| [examples/01-plan-v1-city-outlook.md](examples/01-plan-v1-city-outlook.md) | Worked 5-wave plan with one owner per task and the exact wave-1 briefs |
| [examples/01-plan-v1-city-outlook.json](examples/01-plan-v1-city-outlook.json) | The same plan as machine-checkable data |
| [examples/02-handoff-routing.md](examples/02-handoff-routing.md) | Three expert reports' Handoff items routed into the next wave |
| [examples/03-release-signoff.md](examples/03-release-signoff.md) | Filled-in NO-GO then GO sign-off record and owner message |
| [examples/check-plan.mjs](examples/check-plan.mjs) | Zero-dependency plan validator (owners, cycles, waves, conflicts, security review, sign-off) |

## Key facts at a glance

- Subagents start with a fresh context: briefs must be self-contained.
- Subagents launched from the main conversation start in the background; wait for every completion notification before the next wave.
- Up to 20 concurrent subagents by default; nesting up to three layers below the main conversation.
- `claude --agent orchestrator` makes the orchestrator the main thread (its prompt replaces the default system prompt; CLAUDE.md still loads).
- Anthropic: multi-agent uses about 15x the tokens of chat; most coding tasks have fewer truly parallel parts than research, so fix contracts first, then parallelise by file.
- Rollback on Netlify = publish a previous deploy (no rebuild), then `git revert` on `main`.

## Unconfirmed items

- Use of `.claude/settings.local.json` for a personal `agent` default (local-file semantics not re-checked).
- That a Netlify rollback leaves Blobs data unchanged is inferred from the Blobs page, not stated on the rollback page.
