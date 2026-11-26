# Knowledge: agent-console-engineer

Reference notes and verified examples for building the Agent Console Functions: Claude API calls, streaming, tools, proposals and GitHub commits. Read the relevant doc before writing code in that area; the project skills (`claude-messages-api`, `github-commits-api`, `path-allowlist`, ...) stay the short rules, these files hold the detail and sources.

Last verified: 2026-11-26

## docs/

| File | What it covers |
|---|---|
| `docs/01-messages-api-models-sdk.md` | Model IDs, prices, limits; params current models reject; request/response shape; `@anthropic-ai/sdk` 1.14.0 defaults (retries, timeout, `anthropic-version: 2026-10-21`, Bearer auth). |
| `docs/02-streaming.md` | SSE event order, delta types, mid-stream errors, `messages.stream` / `on("text")` / `finalMessage()` / `abort()`, eager input streaming, Netlify SSE pattern, stop_reason handling. |
| `docs/03-tool-use-strict.md` | Tool fields and name regex, `tool_choice` (any/tool -> 400 on Opus 5.5 / Sonnet 5.5), strict tools and schema limits, the manual tool loop, our three tools. |
| `docs/04-thinking-effort-caching.md` | Adaptive thinking, effort levels and defaults, prompt caching (TTLs, 4 breakpoints, 512-token minimum, prices, invalidators) and the console cache layout. |
| `docs/05-errors-rate-limits-refusals.md` | Error codes and SDK error classes, retry rules, rate limits and headers, refusals (`stop_details`), server-side fallback status. |
| `docs/06-github-rest-commits.md` | GitHub headers and API version `2026-03-10`, contents API, atomic commit via refs/trees/commits with `force: false`, single-file PUT, rate limits. |

## examples/

| File | What it shows |
|---|---|
| `examples/README.md` | How to run the examples and the "Verified" record for each. |
| `examples/package.json` | Example-only deps (`@anthropic-ai/sdk` 1.14.0). Not part of the site build. |
| `examples/01-stream-sse/` | Netlify-style handler streaming a Claude turn as SSE; mock Messages SSE server; test. |
| `examples/02-propose-change-tool/` | Strict `propose_change` tool with `tool_choice: auto`, allow-list check, `is_error` results; mock; test. |
| `examples/03-github-atomic-commit/` | Atomic multi-file commit helper with stale-base check and 422 retry; mock GitHub; test. |

## Unconfirmed items to check before relying on them

- `fallbacks: "default"` (server-side fallback beta) on Opus 5.5 / Sonnet 5.5 - see doc 05.
- Sonnet 5.5 `thinking: {type: "between_tools"}` - see doc 04.
- GitHub User-Agent requirement - see doc 06.
