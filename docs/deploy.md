# Deploying Flood Watch v1 to Netlify

> **Security review by security-engineer is PENDING (owner deferred it on 2026-11-26); do not treat v1 as reviewed.**
> The security *tests* (allow-list attacks, CSRF, replayed approval, auth, fail-closed, secrets grep) run and pass, but no independent review of `netlify/`, `netlify.toml`, auth or the allow-list has been done.

v1 ships the **public app** only (city picker, flood outlook, beach score, settings, offline, install). The Agent Console **UI is deferred**; its Functions are deployed but **fail closed**: until all four console variables below are set, every `/api/*` endpoint answers `503 {"error":{"code":"not_configured","message":"console not configured"}}` and never signs anyone in, calls Claude or touches GitHub.

UI labels below follow Netlify's and GitHub's current wording as far as we know; if a button is named slightly differently in your account, the setting itself is the same. Netlify docs: https://docs.netlify.com/build/configure-builds/overview/ , https://docs.netlify.com/build/environment-variables/overview/ .

## 1. Before you start (local check, 2 minutes)

```bash
npm ci
npm test            # unit, fixture, function and security tests (no network)
npm run build       # writes dist/ and public/console/agents.json, then greps dist/ for secrets
npm run test:e2e    # Playwright, phone viewports, mocked APIs (needs Chromium)
```

All must pass. Do not commit `dist/`, `node_modules/`, `.env` or `public/console/agents.json` (all gitignored).

## 2. Create the site (public app — no environment variables needed)

1. Log in to Netlify → **Add new project** (or **Add new site**) → **Import an existing project** → **GitHub**.
2. Authorise the Netlify GitHub app for the `fenago` account if asked, then pick the repository **`fenago/Flood`**.
3. Build settings (they are also in `netlify.toml`, which wins, so the form only needs to match):

   | Setting | Value |
   |---|---|
   | Branch to deploy | `main` |
   | Base directory | *(empty — repo root)* |
   | Build command | `npm run build` |
   | Publish directory | `dist` |
   | Functions directory | `netlify/functions` |
   | Node version | `22` (set by `[build.environment] NODE_VERSION = "22"` in `netlify.toml`) |

4. **Do not add any environment variables for v1.** The public app needs none: the browser calls Open-Meteo, NOAA and NWS directly (fixed decision 2) and nothing secret exists in the front end.
5. Click **Deploy**. Wait for "Published".
6. Optional: **Domain management** → add your domain. HTTPS is automatic.

### Recommended project settings

- **Build & deploy → Deploy Previews**: on for pull requests (QA runs the e2e suite against the preview URL with `BASE_URL=<preview url> npx playwright test`).
- **Untrusted deploys** (if the repo is public): keep **Require approval** so fork PRs never build with secrets.
- **Environment variables → Secret scanning**: leave on (do not set `SECRETS_SCAN_ENABLED=false`).

## 3. Smoke test right after the first deploy (5 minutes)

Replace `SITE` with your URL.

```bash
curl -sI https://SITE/ | head -1                         # HTTP/2 200
curl -s  https://SITE/manifest.webmanifest | head -3     # JSON
curl -sI https://SITE/sw.js | grep -i cache-control      # no-cache
curl -s  https://SITE/api/agents                         # 503 ... "console not configured"
curl -sI https://SITE/ | grep -i content-security-policy # CSP present
```

On a phone:
1. Open the site, pick **Miami Beach**. The outlook shows NWS alerts (or "No active NWS alerts…" / "Alert status unknown — check weather.gov"), the flood level, next high tides and the beach score. The notice "Flood Watch is not an official warning service…" and "Weather data by Open-Meteo.com" are at the bottom.
2. **Check that NWS answers from the browser.** NWS asks callers for a `User-Agent`, which browsers cannot set (`docs/decisions.md`, provisional). If you see "Alert status unknown" on every load while weather.gov works, tell the orchestrator: the fallback is an NWS proxy Function, which needs an owner decision because it changes fixed decision 2.
3. Turn on airplane mode and reload: the cached outlook and an "Offline. This forecast is from … ago" banner appear.
4. Android Chrome: Settings tab → **Install App**. iPhone Safari: Share → **Add to Home Screen** → turn on **Open as Web App** → **Add** (the app shows these steps on a second visit on another day).

If anything fails: **Deploys** → pick the previous good deploy → **Publish deploy**, then `git revert` the bad commit on `main` (skill `smoke-test-rollback`). For the very first deploy there is nothing to roll back to; unpublish by locking deploys or fix forward.

## 4. Later: turning on the Agent Console Functions

Do this only after security-engineer has reviewed v1 (see the banner at the top) and the console UI ships. All four of the first variables must be set, or the console stays off.

Netlify → **Site/Project configuration → Environment variables → Add a variable**. For every row: **Scopes = Functions only** (needs a Pro plan; on Free/Personal choose the narrowest scope offered), **Contexts = Production** (and Deploy Previews only with *different* values), tick **Contains secret values** where marked. Never put these in `netlify.toml`, the repo, a chat or a log.

| Name | Secret | Required to enable console | Value |
|---|---|---|---|
| `CONSOLE_PASSWORD_HASH` | yes | yes | output of `npm run hash-password` (see below) |
| `SESSION_SECRET` | yes | yes | output of `npm run hash-password` (32 random bytes, base64url). Use a different value per context. |
| `ANTHROPIC_API_KEY` | yes | yes | Claude Console → API keys. Prefer a key with a monthly spend limit. |
| `GITHUB_TOKEN` | yes | yes | fine-grained PAT, see below |
| `GITHUB_REPO` | no | for commits | `fenago/Flood` |
| `GITHUB_BRANCH` | no | for commits | `main` |
| `DAILY_TOKEN_BUDGET` | no | optional | integer, default `1000000` tokens per day (America/New_York) |

`CONTEXT` is set by Netlify itself; Blobs keys are prefixed with it so Deploy Previews never see production sessions or proposals.

### Generate `CONSOLE_PASSWORD_HASH` and `SESSION_SECRET`

On your own computer, in the repo:

```bash
npm run hash-password
# Console password (min 12 characters):   <typed, not echoed>
# CONSOLE_PASSWORD_HASH=scrypt$131072$8$1$<salt>$<hash>
# SESSION_SECRET=<43 characters>
```

Copy each value straight into Netlify. The password is never stored; only the scrypt hash (N=2^17, r=8, p=1, OWASP) is. Clear your terminal afterwards. Rotating `SESSION_SECRET` signs everyone out.

### Create the GitHub token (fine-grained PAT)

GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**:

- **Resource owner**: `fenago`. **Repository access**: *Only select repositories* → `Flood`.
- **Repository permissions**: **Contents: Read and write** (Metadata: Read-only is added automatically). Nothing else — **no** Workflows, Administration, Secrets or Actions.
- **Expiration**: 90 days; put a reminder to rotate.
- Paste it into `GITHUB_TOKEN` (secret). Source: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens

### After setting variables

Trigger **Deploys → Trigger deploy → Deploy site** (Functions read variables at deploy time). Then:

```bash
curl -s https://SITE/api/agents      # now 401 (auth on) instead of 503
```

## 5. Plan notes (Free works for v1)

| Feature | Free | Personal | Pro |
|---|---|---|---|
| Static site, Functions, Blobs, Background Functions | yes | yes | yes |
| Code-based rate-limit rules per project (we use 2: `auth-login`, `agent-chat`) | 2 | 2 | 5 |
| "Contains secret values" + secret scanning controls | — | yes | yes |
| Per-variable **Functions-only** scope | — | — | yes |

v1 (public app) runs fully on Free. For the console, Personal adds secret-value protection; Pro adds Functions-only scoping and 3 more rate-limit rules (we would add `proposal-approve`). Sources: `knowledge/netlify-engineer/docs/04-environment-variables.md`, `05-headers-and-rate-limiting.md`.

## 6. What still needs a real deploy / device / key to verify

- NWS requests from real browsers without a custom `User-Agent` (step 3.2).
- Netlify Blobs returning an ETag on every read in production (our conditional writes refuse to write without one; the local Blobs server does not return one).
- Netlify `rateLimit` rules actually enforcing on `auth-login` and `agent-chat`.
- The `__Host-` session cookie and streaming `/api/agent-chat` on the Netlify runtime; real Claude and GitHub calls (only mocks were used).
- iPhone Safari install, safe areas, VoiceOver; Android TalkBack (WebKit was not available here; the iPhone e2e project ran Chromium with an iPhone viewport).
