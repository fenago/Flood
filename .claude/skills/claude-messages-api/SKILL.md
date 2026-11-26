---
name: claude-messages-api
description: Call the Claude Messages API from Netlify Functions for the Agent Console - SDK, streaming, tool use, thinking and effort, refusals, caching and errors. Use when writing or changing any code that talks to Claude.
user-invocable: false
---
# Claude Messages API (from Functions only)

- SDK: `@anthropic-ai/sdk` (`new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") })`). Never raw fetch, never from the browser.
- Stream every turn: `client.messages.stream({...})`, forward text deltas as SSE, then `await stream.finalMessage()`.
- Check `stop_reason`: `end_turn`, `tool_use` (run tools, return all `tool_result` blocks in one user message), `max_tokens`, `pause_turn` (continue), `refusal` (show a polite message).
- Thinking: `thinking: { type: "adaptive" }`. Set `output_config: { effort }` explicitly (Opus 5.5 default is `medium`). Do not send `budget_tokens`, `temperature`, `top_p` or assistant prefill — current models reject them.
- Tools: define `read_file`, `list_files`, `propose_change` with `strict: true` and `additionalProperties: false`. Use `tool_choice: auto` — forced `any`/`tool` returns 400 on Opus 5.5 and Sonnet 5.5. Parse inputs as JSON, validate against the schema before running.
- Refusal fallback: on Opus 5.5 and Sonnet 5.5 send `fallbacks: "default"` with beta `server-side-fallback-2026-07-01` (the scalar form needs that beta; prefer `"default"` over the array form for Sonnet 5.5). Haiku 5.5 has no server-side fallback. Source: `knowledge/agent-console-engineer/docs/05-errors-rate-limits-refusals.md`.
- Prompt caching: stable system prompt + tools first, `cache_control` breakpoint after them; check `usage.cache_read_input_tokens`.
- Errors: catch SDK classes most-specific first (RateLimitError → backoff; BadRequestError → show; APIConnectionError/5xx → retry). SDK retries twice already.
- Check current details in the Claude API docs before using a new feature.
