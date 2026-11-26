Source: https://code.claude.com/docs/en/sub-agents
Retrieved: 2026-11-26

# Claude Code subagents: what the orchestrator relies on

How the experts in `.claude/agents/` behave when the orchestrator launches them with the Agent tool.

## 1. What a subagent receives and returns

- Each subagent "starts with a fresh, isolated context window". It does **not** see the orchestrator's conversation, files already read, or skills already invoked.
- Its initial context: its own system prompt (the agent file body plus environment details), the **delegation message** the orchestrator writes, the CLAUDE.md hierarchy, a git status snapshot, the full text of every skill in its `skills:` field, and a "sibling roster" reminder listing the other named agents.
- It "returns only the summary" to the caller.
- Consequence for us: every brief must be self-contained (goal, docs to read, files owned, acceptance criteria, report format). Anything the expert needs from an earlier wave must be pasted into the brief.

## 2. How delegation is chosen

- Claude delegates based on the request, the agent's `description` field and current context.
- "use proactively" in a description encourages automatic delegation.
- For our team the orchestrator names the agent explicitly; descriptions still matter when the owner talks to a normal session.

## 3. Foreground vs background

- Default: "With nothing configured, a subagent other than `web-fetch` that Claude spawns from your main conversation starts in the background."
- Background subagents run concurrently. Permission prompts surface in the main session, naming the asking subagent.
- A background subagent's result "reach[es] Claude as a completion notification in a later turn"; Claude waits for that notification before reporting results.
- Foreground subagents block the main conversation until done.
- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` makes Claude wait for subagents to finish before continuing.
- Frontmatter `background: true` keeps a subagent in the background even when Claude asks to wait.
- Practical rule: launch a whole wave, then **wait for every completion notification** before planning the next wave. Never start wave N+1 on a partial set of reports.

## 4. Parallel launches and limits

- For independent work, "spawn multiple subagents to work simultaneously".
- Concurrency cap: at 20 running subagents, another spawn fails with `Concurrent subagent limit reached` (do not retry). Change with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (needs v2.1.217+).
- Our team has 11 experts, so a single wave can never hit the default cap.

## 5. Nesting depth

- "By default, a subagent can spawn subagents of its own, up to three layers below the main conversation." At the limit the `Agent` tool is withheld (except for a fork).
- If `Agent` is left out of `tools`, the agent cannot spawn subagents. Our experts use `disallowedTools: Agent`, which removes it.
- Layers for us: main session (or `claude --agent orchestrator`) -> orchestrator (layer 1, if run as subagent) -> expert (layer 2). Inside the limit.
- Restrict which types an agent may spawn with `Agent(agent_type)` in `tools` when it runs as main thread. The old `Task(...)` name is still an alias (renamed in v2.1.63).

## 6. Resuming

- "To continue an existing subagent's work, ask Claude to resume it." Claude uses `SendMessage` with the agent's ID or name in `to`.
- Transcripts: `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`.
- `maxTurns` stops a subagent; output is marked partial and can be resumed (partial marking needs v2.1.246+).
- Use resume for a follow-up to the *same* expert on the *same* task (e.g. "fix the two failing tests you reported"). Use a fresh launch for a new task.

## 7. Frontmatter fields we use

| Field | Effect |
|---|---|
| `name` | Unique ID (<= 256 chars, no `:`). Filename need not match. |
| `description` | When to delegate. |
| `tools` / `disallowedTools` | Allow-list / deny-list of tools. |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, full ID, or `inherit`. |
| `effort` | `low`..`max`; overrides session effort. |
| `skills` | Full skill content preloaded at start, "up to the first 32 distinct names". |
| `color` | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. |
| `isolation: worktree` | Runs in a temporary git worktree. |
| `maxTurns`, `memory`, `hooks`, `mcpServers`, `permissionMode`, `initialPrompt` | See page. |

- "Claude Code ignores a field it doesn't recognize without reporting an error" - so our `personality:` field is safe.

## 8. Scope priority (highest first)

Managed settings > `--agents` CLI flag > `.claude/agents/` (project) > `~/.claude/agents/` (user) > plugin `agents/`.

## 9. When not to delegate

Keep work in the main thread when it needs back-and-forth, phases share a lot of context, the change is quick and targeted, or latency matters. Delegate when output is verbose, tool restrictions matter, or the work is self-contained and can return a summary.
