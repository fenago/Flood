Source: https://code.claude.com/docs/en/sub-agents
Retrieved: 2026-11-26

# Claude Code subagents (`.claude/agents/<name>.md`)

A subagent file is Markdown with YAML frontmatter. The body is the subagent's system prompt.

## Frontmatter fields (complete list on the official page)

| Field | Req. | Values / notes |
|---|---|---|
| `name` | yes | Unique, <= 256 chars. No `:` (reserved for plugin names like `my-plugin:reviewer`). File name does not have to match (project rule: it does). Hooks see it as `agent_type`. |
| `description` | yes | When Claude should delegate to this agent. |
| `tools` | no | Allow-list, comma string or YAML list. Omitted = inherit all tools available to subagents. If no entry resolves, the agent usually fails to launch. Do not list `Skill` to preload skills - use `skills`. |
| `disallowedTools` | no | Deny-list, same format. Applied first, then `tools`. `Bash(git push *)` still removes all of Bash. Accepts `mcp__server__*`. |
| `model` | no | `sonnet`, `opus`, `haiku`, `fable`, a full ID such as `claude-opus-5-5`, or `inherit`. |
| `permissionMode` | no | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, `manual` (= default). Ignored for plugin agents. |
| `maxTurns` | no | Stop after N agentic turns; output marked partial (partial marking needs v2.1.246+). |
| `autoCompactWindow` | no | Lower auto-compact window, >= 100000 tokens (v2.1.296+). |
| `skills` | no | Skills to **preload**: full content injected at startup, first **32** distinct names. Missing/disabled skills are skipped with a debug-log warning. |
| `mcpServers` | no | Names of configured servers or inline configs. Ignored for plugin agents. |
| `hooks` | no | Lifecycle hooks scoped to this agent. Ignored for plugin agents. |
| `memory` | no | `user`, `project` or `local`: persistent memory dir; loads first 200 lines / 25 KB of its `MEMORY.md`; auto-enables Read, Write, Edit. |
| `background` | no | `true` keeps it in the background even when Claude asks to wait. Custom subagents spawned from the main conversation already start in background by default. |
| `omitClaudeMd` | no | `true` = start without user/project/local CLAUDE.md (v2.1.271+). Ignored with `--agent`. |
| `effort` | no | `low`, `medium`, `high`, `xhigh`, `max` (model-dependent). Overrides session effort, not `CLAUDE_CODE_EFFORT_LEVEL`. |
| `isolation` | no | `worktree`: run in a temporary git worktree (branches from the default branch, not parent HEAD). |
| `color` | no | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. |
| `initialPrompt` | no | Auto-submitted first turn when run as main agent (`--agent`). |
| `experimental` | no | Map; `cacheTtl: 5m` or `1h` (v2.1.248+). |

**Unknown fields are ignored silently.** Multi-word names are camelCase and must match exactly - a typo like `disallowed_tools` is ignored with no error, so the restriction never applies. That is why our validator warns on unknown fields. Our own `personality:` field relies on this behaviour (console cards only).

`color` and `experimental` are not accepted in `--agents` JSON (ignored).

## Skills preload rules

- `skills:` controls what is **preloaded**, not what the agent may use; it can still invoke other skills via the Skill tool.
- A skill with `disable-model-invocation: true` **cannot** be preloaded.
- Only the first 32 distinct names load. Every preloaded skill costs context on every task - keep skills short.

## Where agents come from (priority high -> low)

1. Managed settings (org). 2. `--agents` CLI JSON (session). 3. `.claude/agents/` (project). 4. `~/.claude/agents/` (user). 5. Plugin `agents/`.

## Model resolution order

1. `model` parameter on the Agent tool call (alias only). 2. Frontmatter `model` (incl. `inherit`). 3. `CLAUDE_CODE_SUBAGENT_MODEL`. 4. Parent conversation's model.

## Nesting and parallel work

- By default a subagent can spawn its own subagents up to **three layers below the main conversation** (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`; set `1` to turn nesting off). At the limit the `Agent` tool is withheld (except for a fork).
- Project rule: every expert has `disallowedTools: Agent`; only `orchestrator` delegates. With `claude --agent orchestrator` the orchestrator is the main thread, so experts are layer 1.
- Background subagents run concurrently, use a smaller built-in tool set and surface permission prompts in the main session.

## Running a whole session as an agent

`claude --agent <name>` (or `agent` in `.claude/settings.json`): the main thread takes that agent's system prompt, tool restrictions and model.

## Checklist for a new agent file

- [ ] `name` lowercase-hyphen, matches file name, no `:`.
- [ ] `description` starts with the job and says when to use it.
- [ ] `model`, `effort`, `color` from the allowed values.
- [ ] `disallowedTools: Agent` (unless orchestrator).
- [ ] Every `skills:` entry is an existing `.claude/skills/<name>/SKILL.md` without `disable-model-invocation: true`; <= 32.
- [ ] Body: role, owns, how it works, "Before you answer" pointing at `knowledge/<name>/`, report format with **Handoff**.
- [ ] `knowledge/<name>/` created in the same change; `docs/expert-roster.md` and `CLAUDE.md` updated.
- [ ] `node validate-agents.mjs <repo>` shows 0 errors.
