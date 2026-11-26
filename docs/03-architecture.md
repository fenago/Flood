# 03 · Architecture: static Netlify site + Netlify Functions

## 1. Principles

1. **Static first.** The public app (city picker, flood outlook, beach score) is plain static files served from Netlify's CDN. No server is needed for weather data.
2. **The browser calls Open-Meteo directly.** Open-Meteo is keyless, and its terms warn that apps on Netlify "might be rate-limited earlier than expected" because limits apply per IP. Calling from each user's phone spreads load across user IPs and keeps us inside the free tier.
3. **Functions only where a secret or a write is involved:** the Claude API key, the GitHub token, the console password check, NWS calls (if a `User-Agent` or caching is needed), and Netlify Blobs state.
4. **No secrets ever reach the browser bundle.**

## 2. Diagram

```
 Phone (PWA)                                   Netlify
 ┌──────────────────────────┐        ┌─────────────────────────────────────────┐
 │ index.html / app.js      │◀──CDN──│ Static: /, /console, manifest, sw.js    │
 │ service worker (cache)   │        │                                         │
 │                          │──/api──▶ Functions (netlify/functions/*.mjs)     │
 │  ├─▶ api.open-meteo.com  │        │   auth-login   console password→cookie  │
 │  ├─▶ marine-api.open-... │        │   agents-list  .claude/agents metadata  │
 │  └─▶ NOAA CO-OPS tides   │        │   agent-chat   Claude API (streaming)   │
 └──────────────────────────┘        │   agent-job-background  long agent runs │
                                     │   proposal-approve  GitHub commit       │
                                     │   alerts       NWS proxy + short cache  │
                                     │                                         │
                                     │ Netlify Blobs: sessions, chats, jobs,   │
                                     │   proposals, rate/budget counters       │
                                     └───────┬───────────────┬─────────────────┘
                                             │               │
                                   api.anthropic.com   api.github.com (fenago/Flood)
                                                             │ push to main
                                                             ▼
                                             Netlify continuous deployment → new deploy
```

## 3. Proposed repository layout

```
/
├─ public/                  # static output (or src/ + build step)
│  ├─ index.html            # city picker + outlook
│  ├─ console/index.html    # Agent Console (gated)
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  ├─ data/cities.json
│  ├─ config/scoring.json   # flood + beach weights (agent-editable)
│  └─ icons/
├─ src/                     # app JS modules: api/, scoring/, ui/
├─ netlify/functions/       # server code (NOT agent-editable)
├─ .claude/agents/*.md      # agent definitions (NOT agent-editable)
├─ scripts/build-agents-manifest.mjs
├─ tests/
├─ docs/
└─ netlify.toml
```

Plain HTML + ES modules (or Vite) keeps it simple; a framework is optional. A tiny build step is still useful to (a) generate `agents.json` from `.claude/agents/*.md` and (b) fingerprint assets for the service worker.

## 4. Netlify facts that shape the design

| Fact (Netlify docs) | Consequence |
|---|---|
| Functions live in `netlify/functions/`; modern signature `export default async (req, context) => new Response(...)`, with `export const config = { path: "/api/..." }` for a clean URL. | All server endpoints are under `/api/*`. |
| **Synchronous execution limit: 60 seconds**, not configurable. | A single Claude turn with tools usually fits; a multi-step agent job may not. |
| Buffered request/response payload **6 MB**; **streamed response payload 20 MB**. | Stream chat replies (better UX and larger payloads). The 60 s limit still applies to the invocation **(verify for streamed responses)**. |
| **Background Functions**: up to **15 minutes**; client gets an empty **202** immediately; on error Netlify retries after 1 min, then again 2 min later. Enabled with `config.background` or the legacy `-background` filename suffix. Available on Free, Personal, Pro and Enterprise credit-based plans. | Long agent jobs run here; results go to Blobs; jobs must be **idempotent** because of retries. |
| **Scheduled Functions** (cron) exist. | v2: periodic alert checks for push notifications. |
| **Netlify Blobs**: `import { getStore } from "@netlify/blobs"`; `set`, `setJSON`, `get(key, { type: "json" })`, `delete`, `list({ prefix })`; metadata ≤ 2 KB; keys ≤ 600 bytes; objects ≤ 5 GB. Eventually consistent (≤ 60 s propagation) unless you pass `{ consistency: "strong" }`; conditional writes with `onlyIfMatch` / `onlyIfNew`. `getStore` is site-wide and persists across deploys; `getDeployStore` is per-deploy. | Use **site-wide stores with strong consistency** for sessions, jobs and proposals; use `onlyIfMatch` for status transitions (pending → approved) so a double-click cannot commit twice. |
| Function **rate limiting** is declared in the function's `config.rateLimit` (`windowLimit`, `windowSize` ≤ 180 s, `aggregateBy: ["ip","domain"]`), returns 429 or rewrites. It cannot be set in `netlify.toml`. | Declarative per-IP limits on login, chat and approve. |
| Environment variables can be set in the UI/CLI/API, scoped (e.g. Functions only), and flagged **"Contains secret values"**; function env values must fit AWS Lambda's environment size limits. | Keep secrets few and short (see env table below). |

### Environment variables

| Name | Scope | Secret | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Functions | yes | Claude API |
| `GITHUB_TOKEN` | Functions | yes | Fine-grained PAT, `fenago/Flood` only |
| `GITHUB_REPO` | Functions | no | `fenago/Flood` |
| `GITHUB_BRANCH` | Functions | no | `main` (or a staging branch) |
| `CONSOLE_PASSWORD_HASH` | Functions | yes | scrypt/argon2 hash of the console password |
| `SESSION_SECRET` | Functions | yes | HMAC key for session cookies |
| `DAILY_TOKEN_BUDGET` | Functions | no | Spend cap for Claude usage |
| `NWS_USER_AGENT` | Functions | no | e.g. `FloodWatch (contact via site)` — do not hard-code a personal email |

Never prefix any of these with a bundler's public prefix (`VITE_`, `PUBLIC_`, `NEXT_PUBLIC_`), and add a CI check that greps the built `public/` output for key patterns (`sk-ant-`, `github_pat_`).

## 5. Example `netlify.toml`

```toml
[build]
  command = "node scripts/build-agents-manifest.mjs && npm run build"
  publish = "public"

[functions]
  node_bundler = "esbuild"
  included_files = [".claude/agents/**"]   # agent prompts readable server-side

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; connect-src 'self' https://api.open-meteo.com https://marine-api.open-meteo.com https://geocoding-api.open-meteo.com https://api.tidesandcurrents.noaa.gov https://api.weather.gov; img-src 'self' data:; frame-ancestors 'none'"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

## 6. Deploy flow

- Netlify is connected to `fenago/Flood` with continuous deployment: **every push to the production branch triggers a build and deploy**. That is how "Approve" redeploys the site: the approve function commits to GitHub; Netlify builds the new commit.
- Pull requests/branches get **Deploy Previews**; a safer variant of the console commits to a `agent/<id>` branch and opens a PR, so the change can be checked on a preview URL before merging (see doc 04).
- Rollback: Netlify lets you republish any previous deploy instantly; GitHub keeps the history to revert the commit.

## Sources

- Netlify Functions overview / get started — https://docs.netlify.com/build/functions/overview/ , https://docs.netlify.com/build/functions/get-started/
- Netlify Functions configuration (limits table) — https://docs.netlify.com/build/functions/configuration/
- Netlify Background Functions — https://docs.netlify.com/build/functions/background-functions/
- Netlify Blobs — https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- Netlify environment variables — https://docs.netlify.com/build/environment-variables/overview/
- Netlify rate limiting — https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
- Open-Meteo terms (Netlify IP note) — https://open-meteo.com/en/terms
