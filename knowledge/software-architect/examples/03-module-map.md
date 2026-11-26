# Example 3 - Module map: `src/` and `netlify/functions/`

Target layout for v1 + Agent Console. It follows docs/03-architecture.md section 3, the `vanilla-frontend` skill (`src/api`, `src/scoring`, `src/ui`, `src/console`) and the fixed decisions in CLAUDE.md. Files marked (v2) are not built in v1.

## Browser: `public/` + `src/`

```
public/
  index.html                 app shell: picker + outlook
  console/index.html         Agent Console shell (gated by /api session)
  console/agents.json        generated at build: name, description, model, personality
  manifest.webmanifest       name, icons 192/512, start_url, display
  sw.js                      service worker (DENIED to console proposals)
  data/cities.json           starter cities with lat/lon and NOAA station
  config/scoring.json        flood + beach weights and thresholds
src/
  main.js                    entry: boot, routing between picker and outlook
  api/
    open-meteo.js            forecast + marine (+ geocoding) -> NormalisedWeather
    noaa-tides.js            CO-OPS predictions -> TideSeries
    nws-alerts.js            active alerts by point/zone -> Alert[]
    cache.js                 Cache Storage / IndexedDB wrapper; adds fetchedAt
  scoring/
    flood.js                 scoreFlood(weather, tides, alerts, config) -> FloodResult
    beach.js                 scoreBeach(weather, marine, alerts, config) -> BeachResult
    config.js                load + validate scoring.json
  ui/
    tokens.css               design tokens (Sable)
    picker.js                city list, last choice
    outlook.js               render FloodResult / BeachResult, data age, notice, credit
    install.js               install help (iOS manual steps, Android prompt)
  console/
    api-client.js            fetch wrappers for /api/*, CSRF header, error mapping
    sse.js                   SSE parser for /api/agent-chat (schema in agent-chat.schema.json)
    chat.js                  chat view, continue loop (max 25)
    proposals.js             diff view, approve/reject
    agents.js                agent cards from agents.json
```

## Server: `netlify/functions/` (all DENIED to console proposals)

| File | Path / method | Purpose | Blobs stores | Platform rateLimit? |
|---|---|---|---|---|
| `auth-login.mjs` | `/api/auth-login` POST | password -> session cookie | `sessions`, `counters` | yes (priority 1) |
| `auth-logout.mjs` | `/api/auth-logout` POST | revoke session | `sessions` | no |
| `agents.mjs` | `/api/agents` GET | agent list for the console | - | no (Blobs counter) |
| `agent-chat.mjs` | `/api/agent-chat` POST | one streamed Claude turn | `chats`, `proposals`, `counters`, `sessions` | yes (priority 2) |
| `agent-job.mjs` | `/api/agent-job` POST | create job, invoke background | `jobs`, `counters` | yes on Pro (priority 4) |
| `agent-job-background.mjs` | `config.background = true` | long agent run, <= 15 min, idempotent | `jobs`, `proposals`, `counters` | n/a |
| `job-status.mjs` | `/api/job-status` GET | poll job events | `jobs` | no (Blobs counter) |
| `proposals.mjs` | `/api/proposals/:id` GET | proposal + diff data | `proposals` | no (Blobs counter) |
| `proposal-approve.mjs` | `/api/proposal-approve` POST | re-validate, commit via GitHub | `proposals` | yes (priority 3) |
| `proposal-reject.mjs` | `/api/proposal-reject` POST | pending -> rejected | `proposals` | no (Blobs counter) |

`lib/` (shared code, not endpoints):

| Module | Responsibility |
|---|---|
| `lib/session.mjs` | `requireSession`, cookie HMAC, CSRF + Origin checks |
| `lib/blobs.mjs` | store openers with strong consistency; `casUpdate(store, key, fn)` helper for `onlyIfMatch` loops |
| `lib/ratelimit.mjs` | Blobs-counter limiter for endpoints without a platform rule |
| `lib/budget.mjs` | daily token budget read/add |
| `lib/agents.mjs` | load bundled `.claude/agents/*.md`, parse frontmatter |
| `lib/models.mjs` | alias -> model ID map + allow-list |
| `lib/claude.mjs` | SDK client, streaming turn runner, tool dispatch |
| `lib/tools.mjs` | `read_file`, `list_files`, `propose_change` definitions (strict) |
| `lib/allowlist.mjs` | path allow/deny validation |
| `lib/github.mjs` | contents read, atomic Git Data commit with stale-base check |
| `lib/sse.mjs` | `sseStream()` writer, keep-alive, deadline |
| `lib/errors.mjs` | `jsonError(code)` per the agent-chat error table |

## Dependency rules

| From | May import | Must not import |
|---|---|---|
| `src/scoring/*` | nothing outside `src/scoring` (pure functions) | `src/api`, `src/ui`, DOM, `fetch` |
| `src/api/*` | `src/api/cache.js` | `src/scoring`, `src/ui` |
| `src/ui/*` | `src/api`, `src/scoring` | `src/console` |
| `src/console/*` | own modules, shared `src/ui/tokens.css` | `src/api` (weather), any secret |
| `netlify/functions/*.mjs` | `netlify/functions/lib/*` | each other (endpoints never import endpoints) |
| `netlify/functions/lib/*` | each other, `@netlify/blobs`, `@anthropic-ai/sdk` | anything in `src/` |

## Data flow

```
phone: main.js -> api/* (Open-Meteo, NOAA, NWS direct) -> scoring/* -> ui/outlook.js
console: console/* -> /api/* -> lib/session -> lib/claude | lib/github -> Blobs
```

## Findings to route (for the orchestrator)

1. **NWS alerts location conflict.** docs/03-architecture.md's diagram lists an `alerts` Function ("NWS proxy + short cache"), but CLAUDE.md fixed decision 2 says the browser calls NWS directly and Functions handle only Claude, GitHub and auth. This map follows CLAUDE.md (`src/api/nws-alerts.js`, no `alerts` Function). Handoff: `software-architect` to fix docs/03 diagram and env table (`NWS_USER_AGENT`) or the owner to change the fixed decision.
2. **Platform rate-limit rules.** Netlify allows 2 rules per project on Free/Personal and 5 on Pro (`../docs/04-env-vars-and-rate-limiting.md`). The table above spends them by priority; the rest use `lib/ratelimit.mjs`. Needs an ADR and `security-engineer` review.
3. **Env var scopes need Pro.** Functions-only scoping of secrets is a Pro-plan feature; record the plan assumption in docs/03.
