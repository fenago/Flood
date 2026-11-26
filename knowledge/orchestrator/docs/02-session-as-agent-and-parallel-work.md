Source: https://code.claude.com/docs/en/sub-agents
Source: https://code.claude.com/docs/en/cli-reference
Source: https://code.claude.com/docs/en/settings-reference
Source: https://code.claude.com/docs/en/common-workflows
Retrieved: 2026-11-26

# Running a session as the orchestrator, and other parallel-work tools

## 1. `claude --agent orchestrator`

- CLI reference: `--agent` "Specify an agent for the current session (overrides the `agent` setting)". Example: `claude --agent my-custom-agent`.
- Sub-agents page: the main thread "takes on that subagent's tool restrictions and model".
- If the agent's prompt is not empty, it "replaces the default Claude Code system prompt entirely, the same way `--system-prompt` does".
- CLAUDE.md and project memory still load through the normal message flow (even with `omitClaudeMd`).
- With `-p` and a custom prompt, the session starts without the git status snapshot.
- Confirmation: the agent name shows as `@<name>` in the startup header.
- `initialPrompt` frontmatter is auto-submitted as the first turn only when the agent is the main session agent.

Why this matters: when the orchestrator is the main thread, it is at depth 0 and the experts it launches are at depth 1. It keeps the `Agent` tool because `orchestrator.md` has no `tools:` list and no `disallowedTools: Agent`.

## 2. The `agent` setting

- settings-reference row: `agent` - "Start sessions as a named subagent with its prompt, tools, and model". Category: Agents, sessions, and worktrees. Allowed in any settings file.

```json
{ "agent": "orchestrator" }
```

- `--agent` on the command line overrides it.
- We do **not** set this in the repo: `.claude/` is on the console deny-list and changes go through `agent-builder` plus a human commit. Owners who want it can put it in `.claude/settings.local.json` (local, not committed) (unconfirmed: local file semantics read from the general settings page, not re-checked).

## 3. `--agents` (session-only agents)

- Defines subagents as JSON for one session: `claude --agents '{"reviewer":{"description":"Reviews code","prompt":"You are a code reviewer"}}'`.
- Validated at startup (v2.1.242+); invalid value exits. With `--print` it can be a path to a JSON file (v2.1.281+).
- Priority 2, above project agents. Useful for trying a draft agent before `agent-builder` commits it.

## 4. Other flags the orchestrator may suggest to the owner

| Flag | Use |
|---|---|
| `--model`, `--effort` | Session model / effort (`low`..`max`, `ultracode`). |
| `--permission-mode plan` | Read and plan, no edits until approved. Good for a first planning pass on a big goal. |
| `--resume` / `-r`, `--continue` / `-c` | Pick a session back up; `-c` loads the most recent in this directory. |
| `--worktree` / `-w <name>` | Separate checkout at `<repo>/.claude/worktrees/<name>`. |
| `--max-turns` | Turn cap, print mode only. |
| `claude agents` | Opens agent view to monitor and dispatch parallel background sessions; `--json` prints active sessions. |

## 5. Parallel work options (common workflows)

1. **Subagents in one session** - what the orchestrator does. Findings come back as summaries.
2. **Parallel sessions with worktrees** - `claude --worktree feature-auth` in one terminal, another name in a second. "Each git worktree is a separate checkout on its own branch". Needs at least one commit.
3. **Background agents / agent view** - monitor parallel sessions from one screen (`/en/agent-view`).
4. **Plan mode** - `Shift+Tab` or `--permission-mode plan`; status bar shows `plan mode on`.

### When to use which (our rule of thumb)

| Situation | Choose |
|---|---|
| Independent expert tasks inside one goal | One wave of subagents |
| Two experts editing the same files at once | Sequence them, or give one `isolation: worktree` |
| Two separate owner goals at the same time | Two sessions with `--worktree` |
| Need to keep context between phases | Resume the same expert, do not relaunch |

## 6. Version notes

Several features carry minimum versions (concurrency env var v2.1.217, partial `maxTurns` v2.1.246, `--agents` validation v2.1.242). Check `claude --version` before relying on them.
