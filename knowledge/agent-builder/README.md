# Knowledge: agent-builder

Reference notes and verified examples for writing, wiring and evaluating the Flood Watch agents (`.claude/agents/`) and skills (`.claude/skills/`). The `agent-authoring` and `agent-evaluation` skills hold the short rules; these files hold the detail and the official sources.

Last verified: 2026-11-26

## docs/

| File | What it covers |
|---|---|
| `docs/01-subagents.md` | Every subagent frontmatter field and allowed value, skills preload (32 max, no `disable-model-invocation`), locations, model resolution, nesting depth (3 layers), background, `--agent`, new-agent checklist. |
| `docs/02-skills.md` | SKILL.md frontmatter, invocation control table, 1,536-char listing cap, < 500 lines, compaction budget, locations (and why no `.claude/` inside `knowledge/`). |
| `docs/03-memory-claude-md.md` | CLAUDE.md locations and load order, `@` imports (4 hops), `.claude/rules/`, < 200 lines, auto memory (200 lines / 25 KB), subagent `memory:` and why we don't use it. |
| `docs/04-prompting-current-models.md` | Anthropic prompting guidance for current models: explicit, give the why, examples, XML, don't shout, tools, prefill gone, effort; agent-body checklist. |
| `docs/05-evaluating-agents.md` | Eval principles and grader types from Anthropic docs, our before/after process, task kinds, static checks first, one change at a time. |

## examples/

| File | What it shows |
|---|---|
| `examples/README.md` | How to run, and the "Verified" record for each runnable example. |
| `examples/validate-agents.mjs` | Validator for agent/skill frontmatter and wiring (fields, values, skill links, 32-skill cap, `disallowedTools: Agent`, knowledge folder, roster). Run against the real repo. |
| `examples/model-files/` | A model agent (`claude/agents/beach-copywriter.md`) and skill (`claude/skills/beach-wording/SKILL.md`) that pass the validator with 0 errors, 0 warnings. Uses `claude/` not `.claude/` on purpose. |
| `examples/eval-task-agent-console-engineer.md` | Example eval task file (capability, knowledge, safety, role tasks + scoring table). |
| `examples/package.json` | Example-only dependency (`js-yaml` 5.5.0). |
