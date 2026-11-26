---
name: agent-authoring
description: Write or edit Claude Code subagent files in .claude/agents and skills in .claude/skills for this project, following the official format. Use when creating, improving, or retiring an agent or skill.
user-invocable: false
---
# Agent and skill authoring

## Subagent file (`.claude/agents/<name>.md`)
- Required frontmatter: `name` (lowercase-hyphen, no `:`), `description` (when to delegate — start with the job).
- Optional fields we use: `model` (`opus`, `sonnet`, `haiku`, `fable`, `inherit` or a full ID), `tools` / `disallowedTools`, `skills` (list; full skill text is preloaded, max 32), `color` (red, blue, green, yellow, purple, orange, pink, cyan), `effort`.
- Project field `personality:` is ours for the Agent Console card; Claude Code ignores unknown fields.
- Every expert except `orchestrator` has `disallowedTools: Agent` so handoffs go through the orchestrator.
- Body = system prompt: role, what it owns, how it works, what it must not do, and the required **Handoff** report format.

## Skill file (`.claude/skills/<name>/SKILL.md`)
- `name` = directory name; `description` puts the use case first (listing is truncated at 1,536 chars).
- Background-knowledge skills set `user-invocable: false`. Never set `disable-model-invocation: true` on a skill an agent preloads (it blocks preloading).
- Keep SKILL.md short and imperative (well under 500 lines); move long reference material to sibling files.

## Keep in sync
After any change, update `docs/expert-roster.md` and `CLAUDE.md` if roles or skill ownership moved, and check every `skills:` entry names an existing skill directory.
