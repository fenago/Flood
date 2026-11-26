# 04 · Agent Console: design, security and long jobs

> **v1 status (2026-11-26):** the console **Functions** are built and tested (`netlify/functions/`, `netlify/lib/`) but **fail closed** with 503 "console not configured" until `CONSOLE_PASSWORD_HASH`, `SESSION_SECRET`, `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` are all set. The console **UI is deferred** (owner decision). Endpoints as built: `auth-login`, `auth-logout`, `session` (GET, returns the CSRF token), `agents`, `agent-chat`, `proposals` (GET list or `?id=`), `proposal-approve`, `proposal-reject`; no background job endpoints yet. **Security review PENDING** (`docs/decisions.md`).

The Agent Console is a page inside the deployed app (`/console`) where the owner can:

1. See **every agent in `.claude/agents/`** with its name, model and personality.
2. **Chat** with any agent. The Claude API is called **only from a Netlify Function**; the key lives in an environment variable.
3. Let an agent **propose code changes**. Nothing is written to GitHub until the user reviews the diff and clicks **Approve**; the commit then triggers a Netlify redeploy.

## 1. Agent definitions (`.claude/agents/*.md`)

Claude Code subagents are Markdown files with YAML frontmatter; the body is the agent's system prompt. The standard fields are `name`, `description`, optional `tools`, and optional `model` (an alias such as `opus`, `sonnet`, `haiku`, `inherit`, or a full model ID).

We add one field for the console: `personality` (one short line for the card). Confirmed in the Claude Code subagent docs: Claude Code ignores frontmatter fields it does not recognise, without an error. Agents also list their preloaded knowledge in `skills:` (see `.claude/skills/`).

```markdown
---
name: beach-scorer
description: Tunes the beach-day score weights and thresholds in public/config/scoring.json.
model: sonnet
personality: Upbeat lifeguard; cites NWS and EPA before changing any threshold.
tools: Read, Edit
---
You maintain the beach-day scoring config ...
```

### Listing agents

- At build time, `scripts/build-agents-manifest.mjs` parses the frontmatter and writes `public/console/agents.json` containing **only** `name`, `description`, `model`, `personality` (no prompt bodies — they are not secret, but there is no reason to ship them).
- At run time the chat function reads the full `.md` (bundled via `included_files = [".claude/agents/**"]`) to build the system prompt. Because the agent list is built from the repo, adding an agent = commit a file; the next deploy shows it.

### Model mapping

The agent files use aliases; the function maps them to API model IDs in one place:

| Alias in file | Claude API model ID |
|---|---|
| `opus` / `inherit` / missing | `claude-opus-5-5` (default) |
| `sonnet` | `claude-sonnet-5-5` |
| `haiku` | `claude-haiku-5-5` |
| `fable` | `claude-fable-5-2` |
| full ID (e.g. `claude-opus-5-5`) | used as-is, but only if it is in an allow-list of IDs |

## 2. Claude API usage (from the function)

Use the official TypeScript/JavaScript SDK (`@anthropic-ai/sdk`), not raw `fetch`.

- **Endpoint:** Messages API (`client.messages.stream(...)`). Stream every chat turn: it gives live text to the user and avoids HTTP timeouts on long outputs. Use `await stream.finalMessage()` for the complete message, and check `stop_reason` (`end_turn`, `tool_use`, `max_tokens`, `refusal`, `pause_turn`).
- **Thinking/effort:** use adaptive thinking (`thinking: { type: "adaptive" }`) and set `output_config: { effort: ... }` explicitly — on Claude Opus 5.5 the default effort is `medium`; use `low` for quick chat agents and `high` for code-writing agents. Do not send `budget_tokens` or `temperature` (rejected on current models).
- **Refusals:** handle `stop_reason: "refusal"`. On Opus 5.5 / Sonnet 5.5 enable server-side fallbacks (beta `server-side-fallback-2026-07-01` with `fallbacks: "default"`) so a declined request is retried on a fallback model.
- **Tool use:** agents propose code through a client tool, not free text. Note `tool_choice: { type: "any" | "tool" }` returns **400** on Opus 5.5 and Sonnet 5.5; use `auto` and instruct the agent to call the tool, with `strict: true` on the tool so its input matches the schema.
- **Prompt caching:** the agent's system prompt + tool definitions are stable; put a `cache_control` breakpoint after them to cut cost on multi-turn chats.
- **Errors:** catch SDK error classes in order (rate limit 429 → retry with backoff; 400 → show error; 5xx/connection → retry); the SDK already retries twice by default.

### Tools the function gives agents

| Tool | Runs where | Purpose |
|---|---|---|
| `read_file(path)` | Function → GitHub contents API (GET) | Lets the agent read current code. Restricted to the read allow-list. |
| `list_files(prefix)` | Function → GitHub trees API | Discover files. |
| `propose_change({ summary, files: [{ path, content }] })` | Function only | **Does not write to GitHub.** Validates and stores a proposal in Blobs with status `pending`. |

The agent never gets a "commit" tool. Committing is a human action.

```js
// netlify/functions/agent-chat.mjs  (sketch)
import Anthropic from "@anthropic-ai/sdk";
export const config = {
  path: "/api/agent-chat",
  method: "POST",
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
export default async (req, context) => {
  const session = await requireSession(req);          // 401 if no valid cookie
  const { agent, conversationId, message } = await req.json();
  const def = await loadAgent(agent);                 // from bundled .claude/agents
  await checkDailyBudget();                           // 429 when over budget
  const client = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") });
  const stream = client.messages.stream({
    model: mapModel(def.model),
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: def.effort ?? "medium" },
    system: def.prompt,
    tools: AGENT_TOOLS,                               // read_file, list_files, propose_change (strict)
    messages: await loadHistory(conversationId, message),
  });
  // Pipe text deltas to the browser as Server-Sent Events, run tool calls,
  // persist the final message to Blobs, return within the 60 s limit.
};
```

## 3. Proposal → Approve → Commit → Redeploy

```
Agent calls propose_change
   └─▶ function validates every path against ALLOW-LIST, size limits, no binary
       └─▶ Blobs: proposals/<id> = { status:"pending", baseSha, files, summary, agent }
           └─▶ Console shows side-by-side diff (current file from GitHub vs proposed)
               └─▶ User clicks Approve  (re-enters password or confirms session; CSRF token)
                   └─▶ /api/proposal-approve
                        1. re-validate session, CSRF, allow-list, sizes (never trust the stored copy blindly)
                        2. Blobs status pending→approving with onlyIfMatch (prevents double commit)
                        3. GitHub: one atomic commit (Git Data API, below)
                        4. status → committed {commitSha}; Netlify builds the push
```

### Committing to GitHub

- **Single file:** `PUT /repos/{owner}/{repo}/contents/{path}` with `message`, base64 `content`, `sha` (required when updating), and `branch`. GitHub warns that using this endpoint and *Delete a file* in parallel conflicts — calls must be serial.
- **Several files (recommended):** use the Git Data API for one atomic commit:
  1. `GET /repos/{o}/{r}/git/ref/heads/main` → head commit SHA.
  2. Compare with the proposal's `baseSha`. If main moved, check that none of the proposed files changed since; if they did, mark the proposal **stale** and ask the agent to rebase.
  3. `POST /git/trees` with `base_tree` = head tree and the changed files.
  4. `POST /git/commits` with the new tree and parent = head.
  5. `PATCH /git/refs/heads/main` with the new commit SHA (`force: false`, so a concurrent push fails instead of being overwritten).
- Headers: `Authorization: Bearer $GITHUB_TOKEN`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version` (current docs show `2026-03-10`; pin one version).
- Commit message: `agent(<name>): <summary>` plus a trailer with the proposal ID, so every deploy is traceable to an approval.

**Safer variant (recommended once the app has real users):** commit to a branch `agent/<proposal-id>` and open a PR. Netlify builds a Deploy Preview; a second "Merge" button merges it to main. Costs one more click; gains a working preview before production changes.

## 4. Security

### 4.1 Threat model

| Threat | Example | Control |
|---|---|---|
| Stranger uses the console | Finds `/console` URL | Password gate + session cookie; every `/api/agent-*` and `/api/proposal-*` function checks the session |
| Password guessing | Script tries passwords | `rateLimit` on login (e.g. 5 per 60 s per IP) + lockout counter in Blobs |
| Leaked secrets | Key ends up in JS bundle | Secrets only in Functions-scoped env vars, marked secret; CI grep of built output |
| Agent writes something dangerous | Prompt injection makes an agent edit the approve function or the allow-list | **Path allow-list** that excludes all server code and config; human review of the diff |
| Token over-reach | Leaked token used elsewhere | Fine-grained PAT, one repo, minimum permissions, expiry |
| Double / replayed approval | Double-click, replayed request | `onlyIfMatch` status transition, CSRF token, proposal IDs single-use |
| Runaway cost | Loop or abuse burns API credit | Per-IP rate limits, per-day token budget, `max_tokens` caps, job step limits |
| XSS via agent output | Agent returns `<script>` | Render chat as text/sanitised Markdown; CSP without `unsafe-inline` |

### 4.2 Password gate

- One owner password; store only a **hash** (`CONSOLE_PASSWORD_HASH`, scrypt via `node:crypto`) and compare with `timingSafeEqual`.
- On success, set a cookie `__Host-fw_session=…; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` whose value is an HMAC-signed session ID (`SESSION_SECRET`); store the session in Blobs so it can be revoked ("log out everywhere").
- Approve requires a **CSRF token** and, ideally, password re-entry. Use the **signed double-submit token bound to the session** (token = random + HMAC(`SESSION_SECRET`, session ID + random)) plus `Origin`/`Sec-Fetch-Site` checks. OWASP calls the naive double-submit cookie pattern insecure. Cookie name `__Host-fw_session`. Reference implementation: `knowledge/security-engineer/examples/session-auth.mjs`.
- Password hashing: OWASP's scrypt setting (N=2^17, r=8) needs about 128 MiB, above Node's default `maxmem`; set `maxmem` explicitly.
- Netlify also offers site-level password protection on some plans; it is all-or-nothing for the site, so it does not fit a public app with a private console. Netlify's built-in rate limiting is available on all plans per its availability table.

### 4.3 Fine-grained GitHub token

Create at GitHub → Settings → Developer settings → Fine-grained tokens:

- **Resource owner:** `fenago`. **Repository access:** *Only select repositories* → `Flood`.
- **Permissions:** Repository → **Contents: Read and write** (Metadata: read is included automatically). Add **Pull requests: Read and write** only if using the PR variant. **Do not** grant Workflows (so the token cannot change `.github/workflows`), Administration, or Secrets.
- **Expiration:** e.g. 90 days, with a calendar reminder to rotate. GitHub advises choosing minimal repository access and minimal permissions.
- Store as `GITHUB_TOKEN` in Netlify (Functions scope, secret). For more than one repo or a team, a GitHub App is the scalable alternative (GitHub limits users to 50 fine-grained tokens).

### 4.4 Path allow-list (the most important control)

The agent can only propose files matching the allow-list, and the approve function re-checks it. Example:

```js
// Reference implementation (tested with 40+ attack cases):
// knowledge/security-engineer/examples/allowlist.mjs
const SEG = "[a-z0-9_-]+(?:\\.[a-z0-9_-]+)*";   // lowercase, dots only inside a name
const DIRS = `(?:${SEG}/)*`;
const WRITE_ALLOW = [
  new RegExp(`^public/${DIRS}${SEG}\\.(?:html|css|js|json|svg|webmanifest)$`),
  new RegExp(`^src/${DIRS}${SEG}\\.(?:js|mjs|css|json)$`),
  new RegExp(`^tests/${DIRS}${SEG}\\.(?:js|mjs|json)$`),      // allows tests/x.test.mjs
  new RegExp(`^docs/${DIRS}${SEG}\\.md$`),
];
const WRITE_DENY = [
  /^netlify(?:\/|\.toml$)/, /^\.claude\//, /^\.github\//, /^scripts\//, /^knowledge\//,
  /^package(?:-lock)?\.json$/, /(?:^|\/)\.env/, /^public\/sw\.js$/, /^CLAUDE\.md$/,
  /^public\/_(?:headers|redirects)(?:$|\.)/,
];
// Reject before matching: empty, >200 chars, not NFC, control chars, "..", "\\",
// "//", leading "/", "%", hidden segments ("/." or leading "."). Deny wins over allow.
```

Why these denials: if an agent could edit `netlify/functions/*`, `netlify.toml`, `public/_headers`/`_redirects`, `package.json` (install scripts), the build scripts, `.claude/agents/*` or `knowledge/*` (its own instructions and reference library) or the service worker, one approved change could remove every other safeguard. Changes to those files go through normal human commits. Also cap: ≤ 10 files and ≤ 200 KB per proposal, text only.

### 4.5 Prompt injection

Agents read repository files and user messages; a file could contain instructions aimed at the agent. Controls: the agent has no write tool, the allow-list excludes privileged files, and the human sees the full diff before anything ships. The diff view should highlight changes to `connect-src`-like URLs, `fetch(` calls to new domains, and `<script>` additions.

## 5. Long agent jobs within Netlify's time limits

Synchronous functions stop at **60 s**. A coding agent that reads several files and writes a multi-file proposal can exceed that. Three patterns, in order of preference:

1. **One API turn per request (default).** The browser drives the loop: each `/api/agent-chat` call runs **one** Claude turn (stream text, execute any tool calls, save state to Blobs) and returns. If `stop_reason` is `tool_use`, the client immediately posts "continue". Each invocation stays well under 60 s, and the user watches progress live.
2. **Background job for big tasks.** `/api/agent-job` (sync) creates `jobs/<id>` in Blobs with status `queued` and invokes `agent-job-background`, which runs up to **15 min**, writes progress events to `jobs/<id>/events` and ends with a `pending` proposal. The console polls `/api/job-status?id=` every 2–3 s (or streams it). Because Netlify **retries a failed background function after 1 and 2 minutes**, the job must be idempotent: check status at start, resume from saved state, never double-create proposals.
3. **Cap the work.** `max_tokens` per turn, a maximum of N tool rounds per job (e.g. 25), a per-job token budget (the Claude API's beta task budgets can make the model pace itself), and a wall-clock guard that saves state and stops at ~13 min.

Daily spend guard: after each response add `usage.input_tokens + usage.output_tokens` to a per-day counter in Blobs; refuse new jobs above `DAILY_TOKEN_BUDGET`.

## 6. Endpoints summary

Netlify allows only 2 code-based rate-limit rules per project on Free/Personal (5 on Pro), so only login and chat use Netlify rules; every other limit below is a per-IP counter in Netlify Blobs. Every function sets its own security headers, because `netlify.toml` headers do not apply to Function responses.

| Path | Method | Auth | Rate limit (per IP) | Notes |
|---|---|---|---|---|
| `/api/auth-login` | POST | password | 5 / 60 s (Netlify rule) | sets session cookie |
| `/api/auth-logout` | POST | session | — | revokes session |
| `/api/agents` | GET | session | 30 / 60 s | from bundled manifest |
| `/api/agent-chat` | POST | session | 20 / 60 s (Netlify rule) | one streamed turn |
| `/api/agent-job` | POST | session | 5 / 60 s | starts background job |
| `/api/job-status` | GET | session | 60 / 60 s | polling |
| `/api/proposals/:id` | GET | session | 30 / 60 s | diff data |
| `/api/proposal-approve` | POST | session + CSRF | 5 / 60 s | commits to GitHub |
| `/api/proposal-reject` | POST | session + CSRF | 10 / 60 s | |

## Sources

- Claude API docs (Messages, models, streaming, tool use) — https://platform.claude.com/docs (and the Anthropic SDK for TypeScript)
- GitHub REST, repository contents — https://docs.github.com/en/rest/repos/contents
- GitHub REST, Git trees / commits / refs — https://docs.github.com/rest/git/trees , https://docs.github.com/rest/git/commits , https://docs.github.com/rest/git/refs
- GitHub, Managing personal access tokens — https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- GitHub, Permissions required for fine-grained PATs — https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- Netlify Background Functions, Blobs, rate limiting, env vars — see [03-architecture.md](03-architecture.md#sources)
- Claude Code subagents — https://code.claude.com/docs/en/sub-agents
