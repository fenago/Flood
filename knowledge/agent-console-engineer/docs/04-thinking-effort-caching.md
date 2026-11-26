Source: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking (redirects to /thinking-steering-and-cost)
Source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
Source: https://platform.claude.com/docs/en/about-claude/models/overview
Source: Claude API skill reference (bundled claude-api skill: typescript/claude-api/README.md, shared/prompt-caching.md)
Retrieved: 2026-11-26

# Adaptive thinking, effort and prompt caching

## Thinking

- Request: `thinking: { type: "adaptive" }`. Optional `display: "summarized"` or `"omitted"`.
- On Opus 5.5 thinking is always on: omitting `thinking` equals adaptive; `{type:"disabled"}` and any `budget_tokens` return 400 (skill reference).
- Sonnet 5.5: adaptive by default; `{type:"disabled"}` returns 400 (skill reference says use `{type:"between_tools"}` at effort `high` or below to turn it off - (unconfirmed on official page)).
- Thinking text is omitted by default on current models; set `display: "summarized"` to get summaries. The console does not show thinking to the owner, so leave the default.
- Always send back the full assistant `content` (thinking blocks included) in later turns. Do not edit earlier turns: on current models edited history invalidates thinking blocks and can 400 (skill reference "preserved thinking").

## Effort (`output_config.effort`)

| Level | Behaviour (official page) |
|---|---|
| `low` | Minimises thinking; skips it for simple tasks |
| `medium` | Moderate thinking; may skip for simple queries. **Default on Opus 5.5 and Haiku 5.5** |
| `high` | Thinks on most requests that benefit. Default on most other models (Sonnet 5.5, Fable 5.2) |
| `xhigh` | More readily and deeper than high |
| `max` | Most thinking, no length constraint |

- Effort lives in `output_config`, **not** inside `thinking`.
- Set it explicitly per agent. Project rule (`agent-model-mapping` skill): `effort` frontmatter maps to `output_config.effort`; default `medium` for chat, `high` for code-writing agents.
- Changing effort between requests can invalidate cache (see below). Keep it fixed for a conversation.

## Prompt caching

- Only type: `cache_control: { type: "ephemeral" }`; TTL `5m` (default) or `"1h"` (`{type:"ephemeral", ttl:"1h"}`).
- Up to **4** breakpoints per request. Lookback window: **20 blocks**.
- Automatic caching: one top-level `cache_control` on the request caches up to the last cacheable block.
- Minimum cacheable prefix: **512 tokens** for Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.2 (shorter prefixes silently don't cache - `cache_creation_input_tokens: 0`, no error).
- Prices: 5-minute write 1.25x base input; 1-hour write 2x; reads 0.05x on Opus 5.5 and Sonnet 5.5, 0.025x on Fable 5.1/5.2, 0.1x on others.
- Usage fields: `cache_creation_input_tokens`, `cache_read_input_tokens`, `input_tokens` (uncached part).
- Rate limits: `cache_read_input_tokens` do **not** count toward ITPM (rate limits page).

### What breaks the cache

Render order is `tools` -> `system` -> `messages`; a change invalidates that level and everything after. Invalidators listed on the official page include: tool definition changes, `tool_choice` changes, adding/removing images, thinking parameter changes, `output_config.effort` changes, web search/citations toggles, fast/standard speed switch, dropped thinking blocks.

Silent invalidators to avoid (skill reference): timestamps or UUIDs in the system prompt, non-deterministic JSON key order, tool list order that varies.

### Console layout

1. `tools` (fixed order: `read_file`, `list_files`, `propose_change`; identical text every turn).
2. `system`: the agent's `.md` body, then a breakpoint on the last system block (caches tools + system together).
3. `messages`: history; put a breakpoint on the last block of the newest turn (or use top-level automatic caching).
4. Per-turn data (time, city) goes in the user message, never in `system`.

Check `usage.cache_read_input_tokens > 0` on the second turn of a chat; if it stays 0, look for an invalidator.
