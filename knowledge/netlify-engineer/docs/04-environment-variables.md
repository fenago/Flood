# Environment variables and secrets on Netlify

Source: https://docs.netlify.com/build/environment-variables/overview/
Source: https://docs.netlify.com/build/functions/environment-variables
Source: https://docs.netlify.com/build/environment-variables/secrets-controller
Source: https://cli.netlify.com/commands/env/
Source: https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html
Retrieved: 2026-11-26

Skills: `secrets-management`, `netlify-config-deploy`. Checklist: `../examples/env-checklist.md`.

## Where variables come from

- Netlify UI, CLI, API, or `netlify.toml`. Site variables override shared (team) variables of the same
  key per scope and context.
- **`netlify.toml` variables override** UI/CLI/API values with the same key - and they are **not
  available to Functions** at runtime ("Environment variables and serverless functions" page). Use
  netlify.toml only for build-time values like `NODE_VERSION`.

## Scopes

`Builds`, `Functions`, `Runtime`, `Post processing`. For a function to see a variable, its scope must
include **Functions** (or all scopes). The functions page says per-variable scopes are a **Pro plan
and above** feature - on lower plans every variable reaches every scope (confirm in the UI for this
site's plan; (unconfirmed) how the Free plan UI behaves today).

## Deploy contexts

`Production`, `Deploy Previews`, `Branch deploys`, `Preview server`, `Local development`, and a
specific branch (or branch prefix). CLI context names: `production`, `deploy-preview`, `branch-deploy`,
`dev`, `branch:<name>`. Use different `SESSION_SECRET` values per context so a preview cookie is never
valid in production.

## Secret values (Secrets Controller)

- Tick **Contains secret values** (CLI `--secret`). Values become **write-only**: not readable again
  in UI, CLI or API (except `dev`-context values, which have no secret policy).
- Secrets must be set for **explicit contexts and scopes**, and **cannot use `post processing`**.
- Code running outside Netlify's hosted systems sees **masked** values.
- **Secret scanning** checks repo code and build output (plain, base64, URI-encoded, multi-line) and
  **fails the build**, logging where it found the value. Smart detection also fails builds on likely
  secrets. Controls: `SECRETS_SCAN_ENABLED` (default `true`), `SECRETS_SCAN_OMIT_KEYS`,
  `SECRETS_SCAN_OMIT_PATHS` (substring or glob, relative to repo root),
  `SECRETS_SCAN_SMART_DETECTION_ENABLED`. Changing any of these needs security-engineer review.
- Plans: Personal, Pro and Enterprise. On Free, rely on our own CI grep (`sk-ant-`, `github_pat_` ...).

## Limits

- Keys up to **255 characters**, values up to **5,000 characters** (overview page).
- Functions should also stay within AWS Lambda's limits: total of all variables **<= 4 KB**; keys start
  with a letter, >= 2 chars, letters/digits/underscore only, not reserved by Lambda (AWS page). The
  Netlify functions page applies the 4 KB rule in **Lambda compatibility mode**; keep the total small
  regardless.
- Read-only Netlify variables available to functions at runtime: `URL`, `SITE_NAME`, `SITE_ID`
  (plus AWS's reserved variables).

## When changes apply

Values are captured **at deploy time**. After setting/rotating a variable, **trigger a new deploy**
(or the next push will pick it up). Rolling back to an old deploy runs with that deploy's values
((unconfirmed) - implied by "applied based on the values set at the time of deployment").

## Reading in code

`process.env.NAME` (documented). `Netlify.env.get("NAME")` is what the project skills use
((unconfirmed) on the pages read). Read inside the handler; never log `process.env` or a value.

## CLI (flags confirmed on cli.netlify.com/commands/env)

```bash
netlify env:set NAME value --scope functions --context production deploy-preview --secret
netlify env:set NAME --secret              # convert existing variable to secret
netlify env:list --scope functions --context production [--json | --plain]
netlify env:get NAME --context production --scope functions
netlify env:unset NAME --context production
netlify env:import <file> [--replace-existing]   # never import a committed .env
netlify env:clone --to <project-id> [--from <project-id>]
```
`--scope` values: `builds`, `functions`, `post-processing`, `runtime` (`any` for list/get). Default for
`env:set` is all contexts and all scopes - **always pass `--scope functions` and `--context`** for ours.
Values passed on the command line go into shell history; prefer the UI for secrets.

## Untrusted deploys (deploy overview page)

For public repos, fork PRs are untrusted. Policies: **Require approval** (default), **Build without
sensitive variables**, **Build without restrictions** (never choose this for Flood Watch).
