# Example 2 - Interface spec: `POST /api/agent-chat` (v1)

Status: example spec. Precise enough that `agent-console-engineer` (function) and the console front end (`src/console/`) can be built in parallel. Machine-readable contract: [`agent-chat.schema.json`](agent-chat.schema.json); examples in [`payloads/`](payloads/); checked by [`validate-agent-chat.mjs`](validate-agent-chat.mjs).

Grounding: docs/04-agent-console.md (sections 2, 5, 6), skills `long-running-agent-jobs`, `netlify-blobs`, `console-auth-sessions`, `rate-limiting-cost-guards`; Netlify limits in `../docs/02-netlify-functions.md`.

## 1. Purpose

Run **one** Claude turn for one agent in one conversation, stream it to the browser, save it to Blobs, and tell the client whether to call again. One turn per request keeps each invocation inside Netlify's 60 s limit, which also applies to streamed responses.

## 2. Request

```
POST /api/agent-chat
Content-Type: application/json
Accept: text/event-stream
Cookie: fw_session=<id>.<hmac>; fw_csrf=<token>
X-CSRF-Token: <token>            # must equal fw_csrf cookie
Origin: https://<site host>      # must match the site (or the preview host in deploy-preview context)
```

Body: `$defs/ChatRequest`. Max 32 KB.

| Field | Type | Rule |
|---|---|---|
| `agent` | string | `^[a-z0-9][a-z0-9-]{0,63}$`; must exist in the bundled `.claude/agents` |
| `conversationId` | `null` or `c_<26 Crockford base32>` | `null` starts a new conversation (only with `input.type = "message"`) |
| `turnId` | UUID v4 | Client-generated idempotency key; reuse it when retrying the same turn |
| `input` | `{type:"message", text}` (1..8000 chars) or `{type:"continue"}` | `continue` only after `done.next = "continue"` |

The client never chooses the model, tools, effort or system prompt (unknown fields are rejected).

## 3. Response: Server-Sent Events

`200`, `Content-Type: text/event-stream`, `Cache-Control: no-store`. Each event is `event: <name>` + one `data: <JSON>` line + blank line. Lines starting with `:` are keep-alives; clients ignore them.

| Event | When | `data` (see schema) |
|---|---|---|
| `start` | exactly once, first | `conversationId`, `turn`, `turnId`, `agent`, `model` |
| `text` | 0..n | `delta` (<= 4000 chars). Render as text / sanitised Markdown, never `innerHTML` |
| `tool` | 0..n | `callId`, `name` (`read_file` / `list_files` / `propose_change`), `status` (`started`/`ok`/`error`), `summary` (<= 200 chars, no file contents) |
| `proposal` | 0..n, only after a `propose_change` tool event | `proposalId`, `summary`, `files[{path, bytes, change}]` (<= 10 files, <= 200 KB) |
| `done` | exactly once, last (success) | `stopReason`, `next`, `usage`, optional `budget` |
| `error` | exactly once, last (failure after stream start) | same body as JSON errors (section 5) |

`stopReason` -> `next`:

| stopReason | Meaning | next |
|---|---|---|
| `end_turn` | agent finished | `none` |
| `tool_use` | tools ran; results saved; model must see them | `continue` |
| `pause_turn` | API paused a long turn | `continue` |
| `deadline` | server stopped at its 50 s deadline and saved state | `continue` |
| `max_tokens` | output cap hit | `none` (UI offers "Continue") |
| `refusal` | model declined | `none` (UI shows a polite message) |

Client loop: on `next = "continue"`, POST again with the same `conversationId`, a **new** `turnId`, and `input: {type:"continue"}`. Stop after 25 consecutive continues and ask the user (matches the 25-tool-round cap).

## 4. Server behaviour (in order)

1. `requireSession` -> 401; CSRF + Origin -> 403; body schema -> 400; size -> 413.
2. Platform `rateLimit` 20 / 60 s per IP (if the plan has a rule left; otherwise Blobs counter) -> 429.
3. Load agent from bundled `.claude/agents/<agent>.md` -> 404 `unknown_agent`.
4. Daily budget check on `counters/tokens/<YYYY-MM-DD>` -> 429 `budget_exhausted` with `retryAfterSeconds` until local midnight.
5. Load `chats/<conversationId>` (strong consistency) or create it with `onlyIfNew`. Unknown id -> 404 `unknown_conversation`.
6. Idempotency: `turnId` in `processedTurnIds` -> 409 `duplicate_turn`.
7. Lock: write `status:"running", runningSince` with `onlyIfMatch: etag`. If already running and `runningSince` < 70 s ago -> 409 `conversation_busy` (`retryAfterSeconds: 5`). Older locks are stale and may be taken over.
8. Stream one Claude turn (model from the model map; tools `read_file`, `list_files`, `propose_change`; no commit tool). Run tool calls inside this request. `propose_change` validates the allow-list and stores `proposals/<proposalId>` with `onlyIfNew`.
9. At 50 s wall clock, stop, save, emit `done` with `stopReason:"deadline"`.
10. Save the record (append messages, `turn+1`, add `turnId`, `status:"idle"`) with `onlyIfMatch`; add usage to the daily counter (may use `context.waitUntil`).
11. Emit `done`. On any failure after step 8 started: save what is safe, release the lock, emit `error`.

## 5. Errors

Before the stream starts: JSON `{"error": ErrorBody}` with HTTP status. After it starts: an `error` SSE event (HTTP status is already 200).

| code | HTTP | retryable | Notes |
|---|---|---|---|
| `bad_request` | 400 | no | schema failure; message names the field |
| `unauthenticated` | 401 | no | console shows login |
| `csrf_failed` | 403 | no | |
| `unknown_agent` / `unknown_conversation` | 404 | no | |
| `conversation_busy` | 409 | yes | `retryAfterSeconds` required |
| `duplicate_turn` | 409 | no | client already has this turn; reload conversation |
| `payload_too_large` | 413 | no | |
| `rate_limited` | 429 | yes | `retryAfterSeconds` required |
| `budget_exhausted` | 429 | yes | `retryAfterSeconds` required |
| `claude_unavailable` | 502 | yes | after SDK retries |
| `internal` | 500 | no | never include stack traces, env values or prompts |

Every error has `requestId` (from `context.requestId`) for log lookup.

## 6. Blobs

| Store | Key | Value | Consistency / writes |
|---|---|---|---|
| `chats` | `<conversationId>` | `$defs/ChatRecord` (Claude content blocks stored as-is) | strong; create `onlyIfNew`, update `onlyIfMatch` |
| `proposals` | `<proposalId>` | proposal (owned by the approve-flow spec) | strong; `onlyIfNew` |
| `counters` | `tokens/<YYYY-MM-DD>` | `{inputTokens, outputTokens}` | strong; `onlyIfMatch` retry x3 |
| `sessions` | `<sha256(sessionId)>` | read only here | strong |

Keys are ASCII and far below the 600-byte limit. A record holds at most 400 messages and 50 recent `processedTurnIds`; past that the console starts a new conversation. Records carry `schemaVersion: 1`; new fields must be optional so a rolled-back deploy can still read them.

## 7. Limits recap

| Limit | Value | Source |
|---|---|---|
| Function wall clock (also streamed) | 60 s; our deadline 50 s | Netlify Functions API / configuration |
| Streamed response | 20 MB | same |
| Request body | 32 KB (ours; platform allows 6 MB) | design |
| Proposal | <= 10 files, <= 200 KB | `path-allowlist` skill |
| Platform rate-limit window | <= 180 s | Netlify rate limiting |

## 8. Validation

```bash
AJV_DIR=<scratch dir with ajv@8> node knowledge/software-architect/examples/validate-agent-chat.mjs
```

Both sides should run their fixtures through the same schema in tests (`function-testing-mocks` for the function, unit tests for the console parser).
