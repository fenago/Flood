# agent-console-engineer: worked examples

Small, runnable examples. None of them call the real Claude API or GitHub: each test starts a local mock HTTP server and points the client at it. No real keys are used.

| Folder | Shows |
|---|---|
| `01-stream-sse/` | Netlify-style handler `export default async (req) => Response` that streams one Claude turn to the browser as Server-Sent Events with `client.messages.stream(...)`, `stream.on("text")` and `await stream.finalMessage()`. Mock emits a real Messages SSE sequence (incl. `ping`). |
| `02-propose-change-tool/` | One tool-use turn with a `strict: true` `propose_change` tool, `tool_choice: {type: "auto"}`, streamed `input_json_delta` input, and allow-list validation before storing a pending proposal. Denied paths come back as `is_error` tool results. |
| `03-github-atomic-commit/` | Multi-file commit helper: get ref, get commit, stale-base check, create tree, create commit, update ref with `force: false`, one retry on 422. Mock GitHub keeps refs/trees/commits in memory. |

`allowlist.mjs` in 02 is an illustrative copy of `.claude/skills/path-allowlist`; the real module (`netlify/functions/lib/allowlist.mjs`) is owned by `security-engineer`.

## How to run

The deps are listed in `package.json` here (`@anthropic-ai/sdk` 1.14.0). Do not install them at the repo root. Either `npm install` inside a copy of this folder, or link it into a scratch folder that has `node_modules`:

```bash
W=/path/to/scratch   # contains node_modules/@anthropic-ai/sdk
ln -sfn "$PWD" "$W/ace" && cd "$W"
node --preserve-symlinks --preserve-symlinks-main ace/01-stream-sse/test.mjs
```

## Verified (2026-11-26, Node v22.23.5, @anthropic-ai/sdk 1.14.0)

- **01-stream-sse** - `node --preserve-symlinks --preserve-symlinks-main ace/01-stream-sse/test.mjs`
  Output: `SSE events: delta,delta,delta,done`; `text: "Low flood risk today." stop_reason: end_turn`; `request headers: anthropic-version = 2026-10-21 | auth scheme = Bearer`; `PASS 01-stream-sse`. Also asserts the request body had `stream: true`, `model: claude-opus-5-5`, `thinking: {type: "adaptive"}`, `output_config: {effort: "medium"}` and no `temperature`/`top_p`.
- **02-propose-change-tool** - `node --preserve-symlinks --preserve-symlinks-main ace/02-propose-change-tool/test.mjs`
  Output: `turn 1: stored -> Stored proposal p_1 as pending...`; `turn 2: rejected -> Proposal rejected: "netlify.toml": path is on the deny-list; "docs/../.claude/agents/x.md": traversal or encoded character; "public/sw.js": path is on the deny-list`; `PASS 02-propose-change-tool`. Asserts `tool_choice` was `auto` and the tool had `strict: true` and `additionalProperties: false`.
- **03-github-atomic-commit** - `node --preserve-symlinks --preserve-symlinks-main ace/03-github-atomic-commit/test.mjs`
  Output: `1 happy path: commit ... attempts 1`; `2 stale base: rejected with 409, head unchanged`; `3 unrelated change on main: committed on new head`; `4 ref race: 422 then retry, attempts = 2`; `requests: 28 | PATCH calls: 4`; `PASS 03-github-atomic-commit`.

Not verified here: behaviour of the real Claude API and real GitHub (mocks only), and running inside the Netlify Functions runtime (`Netlify.env` is replaced by `process.env` in tests).
