# netlify-engineer knowledge

Reference notes and runnable examples for the `netlify-engineer` agent
(`.claude/agents/netlify-engineer.md`). Notes are written from official Netlify docs
(docs.netlify.com, cli.netlify.com) plus one AWS Lambda page; anything not confirmed there is marked
"(unconfirmed)".

Last verified: 2026-11-26

## docs/

| File | One line |
|---|---|
| `docs/01-functions-runtime-and-config.md` | Modern handler signature, `context` and `config` fields, limits table (60 s / 6 MB / 20 MB / 256 KB background), streaming, bundling. |
| `docs/02-background-and-scheduled-functions.md` | Background mode (202, 15 min, retries at 1 and 2 min) with our idempotent job pattern; scheduled functions (30 s, UTC, published deploys only). |
| `docs/03-netlify-blobs.md` | `getStore` vs `getDeployStore`, API, eventual (60 s) vs strong consistency, `onlyIfNew`/`onlyIfMatch`, limits, and gotchas found running the real library. |
| `docs/04-environment-variables.md` | Scopes, contexts, Secrets Controller and scanning, size limits, netlify.toml vars not reaching Functions, redeploy rule, CLI flags. |
| `docs/05-headers-and-rate-limiting.md` | `_headers` vs `[[headers]]` (not applied to Functions), non-overridable headers, `config.rateLimit` and the per-plan rule-count limits. |
| `docs/06-netlify-toml-deploys-cli.md` | netlify.toml sections, deploy model, Deploy Previews, rollback and retention, `netlify dev`/CLI. |

## examples/

| File | One line |
|---|---|
| `examples/README.md` | What each example shows, exact commands and "Verified" results. |
| `examples/netlify.toml` | Complete example config for Flood Watch (build, functions, contexts, dev, security headers). |
| `examples/functions/agent-job.mjs` | Sync starter wrapper: `config` with `path`, `method`, `rateLimit`. |
| `examples/functions/agent-job.core.mjs` | Starter logic: session check, input validation, `onlyIfNew` job record, signed background invoke. |
| `examples/functions/agent-job-background.mjs` | Background wrapper: `config = { background: true }`. |
| `examples/functions/agent-job-background.core.mjs` | Idempotent, resumable, retry-safe job loop with conditional writes and guards. |
| `examples/functions/lib/http.mjs` | JSON response helper with function security headers; env reader. |
| `examples/memory-blobs.mjs` | In-memory Blobs store stub with documented etag/conditional-write semantics. |
| `examples/test-job.mjs` | 6 tests calling the handlers with a `Request` + context (all pass, 20/20 runs). |
| `examples/blobs-local-server.test.mjs` | 4 tests against real `@netlify/blobs` + `BlobsServer` (all pass; documents local gotchas). |
| `examples/env-checklist.md` | Every env var: scope, contexts, secret flag, owner, format; release checks; CLI commands. |

## Main findings to act on (details in the docs)

1. **Rate-limit rule caps**: 2 code-based rules per project on Free/Personal, 5 on Pro; the console plans 8 (doc 05).
2. **Headers**: netlify.toml `[[headers]]` do not apply to Function responses (doc 05).
3. **Env vars**: netlify.toml variables do not reach Functions; per-scope settings are Pro+; changes need a redeploy (doc 04).
4. **Blobs**: `onlyIfMatch: undefined` silently writes unconditionally - guard for a missing ETag (doc 03).
5. **Background payload** limit is 256 KB - pass IDs, keep state in Blobs (doc 02).
6. **Streaming** keeps the 60 s limit (confirmed) - resolves the open note in `docs/03-architecture.md` (doc 01).
7. **Previews share site-wide Blobs** with production - decide on key prefixes or read-only previews (doc 03).
