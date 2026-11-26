---
name: netlify-config-deploy
description: Manage netlify.toml, builds, environment variables, deploy previews, continuous deployment and rollback for Flood Watch. Use when changing build or deploy settings or diagnosing a failed deploy.
user-invocable: false
---
# Netlify config and deploys

Detail and sources: `knowledge/netlify-engineer/docs/04`, `05`, `06`; checklist `knowledge/netlify-engineer/examples/env-checklist.md`.

- `netlify.toml`: `[build] command`, `publish = "public"`, `[functions] node_bundler = "esbuild"`, `included_files`, and `[[headers]]` (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Cache-Control: no-cache` for `/sw.js`). Headers live only in `netlify.toml`, never `public/_headers`.
- `[[headers]]` cover static files only - **not Function responses**. Functions set their own security headers (see `netlify-functions-runtime`).
- Continuous deployment: every push to the production branch (`main`) builds and deploys. Branches/PRs get Deploy Previews — test there first.
- Environment variables: set in Netlify UI/CLI (`netlify env:set NAME --scope functions --context <ctx> --secret`), scope secrets to **Functions**, tick "Contains secret values". Never use public bundler prefixes (`VITE_`, `PUBLIC_`). Keep the total small (AWS Lambda 4 KB).
  - Variables declared in `netlify.toml` are **not visible to Functions** (and override UI values) - use it only for build values like `NODE_VERSION`.
  - Per-variable scopes are **Pro plan and above**; on lower plans every variable reaches every scope.
  - Secret values (write-only) and secret scanning need **Personal plan or above**; on Free rely on our CI grep.
  - Values are fixed at deploy time: **redeploy after any env change** (set or rotate).
- Required vars: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `CONSOLE_PASSWORD_HASH`, `SESSION_SECRET`, `DAILY_TOKEN_BUDGET`, `NWS_USER_AGENT`. Use a different `SESSION_SECRET` per deploy context.
- Local dev: `netlify dev` runs site + functions with env vars.
- Rollback: publish the previous deploy in Netlify (instant), then revert the commit in Git so `main` matches. Blobs data is not rolled back.
- Changes to `netlify.toml` need `security-engineer` review.
