# Deploying Flood Watch v1 to Netlify

> **Security review by security-engineer is PENDING (owner deferred it on 2026-11-26); do not treat v1 as reviewed.**
> The security *tests* (allow-list attacks, CSRF, replayed approval, auth, fail-closed, secrets grep) run and pass, but no independent review of `netlify/`, `netlify.toml`, auth or the allow-list has been done.

v1 ships the **public app** only (city picker, flood outlook, beach score, settings, offline, install). The Agent Console **UI is deferred**; its Functions are deployed but **fail closed**: until the required console variables below are set, every `/api/*` endpoint answers `503 {"error":{"code":"not_configured","message":"console not configured"}}` and never signs anyone in, calls Claude or touches GitHub.

UI labels below follow Netlify's and GitHub's current wording as far as we know; if a button is named slightly differently in your account, the setting itself is the same. Netlify docs: https://docs.netlify.com/build/configure-builds/overview/ , https://docs.netlify.com/build/environment-variables/overview/ .

## 1. Before you start (local check, 2 minutes)

```bash
npm ci
npm test            # unit, fixture, function and security tests (no network)
npm run build       # writes dist/ (incl. dist/vendor/supabase.mjs) and public/console/agents.json, then greps dist/ for secrets
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

4. **Do not add any environment variables for the public app.** It needs none: the browser calls Open-Meteo, NOAA and NWS directly (fixed decision 2). Sign-in config (Supabase URL and publishable key, both public by design) is in `public/config/auth.json`; nothing secret exists in the front end. Do the one-time **Supabase Auth setup** (section 4) for sign-in to work.
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

## 4. Accounts: Supabase Auth setup (owner does this once)

Fixed decision (owner): users register and sign in with **Supabase Auth** (email + password, and Google). Supabase stores **accounts only**; **Netlify Blobs stays the only data storage**. Project: `https://ygdswggaxtyzlcscgdrf.supabase.co`. Production site: `https://my-flood-21.netlify.app`.

### Supabase Auth setup (owner does this once)

Sources: https://supabase.com/docs/guides/auth/social-login/auth-google , https://supabase.com/docs/guides/auth/redirect-urls (read 2026-11-26). Dashboard labels move; the setting is what matters.

**A. Google OAuth client (Google Cloud Console)**

1. Open https://console.cloud.google.com , pick or create a project.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID** (Supabase's page names the same screen *Google Auth Platform → Clients → Create client*). If asked, first configure the consent screen; keep the default scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (add `openid` manually if it is missing).
3. **Application type: Web application.**
4. **Authorized redirect URIs → Add URI:** `https://ygdswggaxtyzlcscgdrf.supabase.co/auth/v1/callback`
5. **Authorized JavaScript origins** (Supabase's page says to add your app's URL): `https://my-flood-21.netlify.app`, and `http://localhost:4173` for local testing (remove it when you no longer test locally).
6. **Create**, then copy the **Client ID** and **Client secret**.

**B. Supabase dashboard (https://supabase.com/dashboard → project `ygdswggaxtyzlcscgdrf`)**

1. **Authentication → Sign In / Providers → Google**: switch **Enable** on, paste the **Client ID** and **Client secret**, **Save**. Leave *Skip nonce check* off (it is for native iOS only).
2. **Authentication → URL Configuration**:
   - **Site URL:** `https://my-flood-21.netlify.app`
   - **Redirect URLs** (add each):
     - `https://my-flood-21.netlify.app/**`
     - `https://*--my-flood-21.netlify.app/**` (Netlify deploy previews and branch deploys; `*` matches one dot-free label such as `deploy-preview-5`, `**` any path)
     - `http://localhost:4173/**` (local `npm run serve`)
3. **Authentication → Sign In / Providers → Email**: keep it enabled and keep **Confirm email** **on** (new accounts must verify their address). *The exact dashboard wording of this toggle was not confirmed in the docs we read; check it on screen.*

**C. Never put these in the repo, in Netlify, or in chat**

- The **Google client secret** (it lives only in the Supabase dashboard).
- A Supabase **secret key** (`sb_secret_...`) or the legacy **`service_role`** key.

None of them is needed by this app. The **publishable** key (`sb_publishable_...`) is public by design and is committed in `public/config/auth.json`. `npm run build` fails if `dist/` contains `sb_secret_...` or a `service_role` JWT (`scripts/check-secrets.mjs`).

**D. Check**

On the production site, register with an email (confirm it from the email), sign out, sign in with Google. Then open a Deploy Preview and sign in with Google there (this exercises the `*--my-flood-21` redirect pattern).

**Rollback:** every step above is a dashboard setting. To undo, switch the Google provider off and remove the added Redirect URLs; the app keeps working without accounts. Note what you changed and when (names only, no secrets) in `docs/decisions.md`.

## 4b. Later: turning on the Agent Console Functions

Do this only after security-engineer has reviewed (see the banner at the top) and the console UI ships. The console now uses the same Supabase sign-in: a Function verifies the Supabase access token and lets in only emails listed in `CONSOLE_ADMIN_EMAILS`. There is no console password and no session secret any more. If a required variable is missing the console stays off (`503 not_configured`).

Netlify → **Site/Project configuration → Environment variables → Add a variable**. For every row: **Scopes = Functions only** (needs a Pro plan; on Free/Personal choose the narrowest scope offered), **Contexts = Production** (and Deploy Previews only with *different* values), tick **Contains secret values** where marked. Never put these in `netlify.toml`, the repo, a chat or a log.

| Name | Secret | Required to enable console | Value |
|---|---|---|---|
| `SUPABASE_URL` | no | yes | `https://ygdswggaxtyzlcscgdrf.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | no (public by design) | yes | the `sb_publishable_...` key from Supabase → Project Settings → API Keys |
| `CONSOLE_ADMIN_EMAILS` | no | yes | comma-separated owner emails, e.g. `a@example.com,b@example.com` (an unlisted account can sign in to the public app but never reach the console) |
| `ANTHROPIC_API_KEY` | yes | yes | Claude Console → API keys. Prefer a key with a monthly spend limit. |
| `GITHUB_TOKEN` | yes | yes | fine-grained PAT, see below |
| `GITHUB_REPO` | no | for commits | `fenago/Flood` |
| `GITHUB_BRANCH` | no | for commits | `main` |
| `DAILY_TOKEN_BUDGET` | no | optional | integer, default `1000000` tokens per day (America/New_York) |

`CONTEXT` is set by Netlify itself; Blobs keys are prefixed with it so Deploy Previews never see production proposals.

Removed with the move to Supabase: `CONSOLE_PASSWORD_HASH` and `SESSION_SECRET`. If they are still set in Netlify, delete them and redeploy. The helper `scripts/hash-password.mjs` (`npm run hash-password`) is now unused by the console; deleting it (and its `package.json` entry) is left to the orchestrator because `scripts/dev-functions.mjs` and the old tests still import the password code.

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
| Code-based rate-limit rules per project (we use 2: `session`, `agent-chat`) | 2 | 2 | 5 |
| "Contains secret values" + secret scanning controls | — | yes | yes |
| Per-variable **Functions-only** scope | — | — | yes |

v1 (public app) runs fully on Free. Supabase Auth is on the Supabase side (see its own plan limits). For the console, Personal adds secret-value protection; Pro adds Functions-only scoping and 3 more rate-limit rules (we would add `proposal-approve`). Sources: `knowledge/netlify-engineer/docs/04-environment-variables.md`, `05-headers-and-rate-limiting.md`.

## 6. What still needs a real deploy / device / key to verify

- NWS requests from real browsers without a custom `User-Agent` (step 3.2).
- Netlify Blobs returning an ETag on every read in production (our conditional writes refuse to write without one; the local Blobs server does not return one).
- Netlify `rateLimit` rules actually enforcing on `session` and `agent-chat`.
- The `__Host-` session cookie and streaming `/api/agent-chat` on the Netlify runtime; real Claude and GitHub calls (only mocks were used).
- iPhone Safari install, safe areas, VoiceOver; Android TalkBack (WebKit was not available here; the iPhone e2e project ran Chromium with an iPhone viewport).
