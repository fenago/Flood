---
name: netlify-config-deploy
description: Manage netlify.toml, builds, environment variables, deploy previews, continuous deployment and rollback for Flood Watch. Use when changing build or deploy settings or diagnosing a failed deploy.
user-invocable: false
---
# Netlify config and deploys

- `netlify.toml`: `[build] command`, `publish = "public"`, `[functions] node_bundler = "esbuild"`, `included_files`, and `[[headers]]` (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Cache-Control: no-cache` for `/sw.js`).
- Continuous deployment: every push to the production branch (`main`) builds and deploys. Branches/PRs get Deploy Previews — test there first.
- Environment variables: set in Netlify UI/CLI (`netlify env:set`), scope secrets to **Functions**, tick "Contains secret values". Never use public bundler prefixes (`VITE_`, `PUBLIC_`). Values must fit AWS Lambda env size limits — keep them short.
- Required vars: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, `CONSOLE_PASSWORD_HASH`, `SESSION_SECRET`, `DAILY_TOKEN_BUDGET`, `NWS_USER_AGENT`.
- Local dev: `netlify dev` runs site + functions with env vars.
- Rollback: publish the previous deploy in Netlify (instant), then revert the commit in Git so `main` matches.
- Changes to `netlify.toml` need `security-engineer` review.
