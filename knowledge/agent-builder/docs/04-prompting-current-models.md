Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
Source: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking (now /thinking-steering-and-cost)
Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
Retrieved: 2026-11-26

# Writing agent prompts for current Claude models

Applies to the agent bodies in `.claude/agents/` and to skill text. Current default model is `claude-opus-5-5` (`opus`).

## Core guidance (prompting best practices)

- **Be explicit.** "Claude responds well to clear, explicit instructions." Say what done looks like.
- **Give the why.** Explaining why a rule matters helps the model apply it to cases you did not list. Example: "Lead with the veto, because people act on the first line."
- **Examples steer format** reliably - "one of the most reliable ways to steer Claude's output format, tone, and structure." Our report template is such an example.
- **XML tags** help when a prompt mixes instructions, context, examples and inputs (e.g. wrap pasted file content in `<file path="...">`).
- **Role in the system prompt** focuses behaviour and tone ("You are agent-console-engineer...").
- **Say what to do, not what not to do** for format control; match the prompt's style to the output you want.

## Don't shout

Current models follow instructions precisely and may **over**-trigger on aggressive wording. Replace "CRITICAL: You MUST use this tool when..." with "Use this tool when...". Keep MUST/NEVER for true safety lines (secrets, deny-list), and give the reason next to them.

## Tools and parallel work

- Name tools specifically and describe when to use them; descriptions matter more than names.
- Latest models run independent tool calls in parallel; a prompt can encourage it ("run independent reads in parallel").
- Latest models orchestrate subagents natively. For us only the orchestrator delegates; experts say "describe what you need in your Handoff" instead.
- On Opus 5.5 / Sonnet 5.5 a tool cannot be forced via `tool_choice` (400). The prompt has to say when to call the tool; the API uses `tool_choice: auto`.

## Agentic coding

- "Never speculate about code you have not opened." Tell agents to read the file before answering about it.
- Avoid over-engineering: "Only make changes that are directly requested or clearly necessary." Matches our "keep changes small" rule.
- Give verification tools and structured tests; ask for incremental progress on long tasks ("steady advances on a few things at a time").

## Thinking and effort

- Thinking is adaptive on current models; steer depth with `effort` (`low` ... `max`), not with token budgets. Opus 5.5 default is `medium`.
- Prefer general instructions ("think carefully about edge cases before proposing") over step-by-step scripts.
- In agent frontmatter, `effort:` sets the level for Claude Code; the console maps the same field to `output_config.effort`.

## Things that no longer work

- **Prefill** (putting words in the assistant's mouth) returns 400 on Claude 4.6+ models. Use instructions or structured outputs instead.
- `temperature` / `top_p` tweaks are rejected on current models; do not rely on them for consistency.

## Checklist for an agent body (project)

1. One-line role. 2. "Before you answer" pointing at `knowledge/<name>/`. 3. What it owns (paths). 4. How it works (3-6 bullets with reasons). 5. Shared expert rules. 6. Report format with Result / Checks / Handoff / Risks.

Change one thing at a time and run the eval tasks (`05-evaluating-agents.md`) before and after.
