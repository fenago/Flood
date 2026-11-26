# netlify.toml, deploys, rollback and the CLI

Source: https://docs.netlify.com/build/configure-builds/file-based-configuration/
Source: https://docs.netlify.com/deploy/deploy-overview/
Source: https://docs.netlify.com/deploy/deploy-types/deploy-previews/
Source: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/
Source: https://docs.netlify.com/deploy/create-deploys/
Source: https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/
Source: https://docs.netlify.com/api-and-cli-guides/cli-guides/local-development/
Retrieved: 2026-11-26

Skills: `netlify-config-deploy`, `smoke-test-rollback`, `release-signoff`. Example: `../examples/netlify.toml`.

## netlify.toml (file-based configuration)

- Lives at the repo root (else set base/package directory). If a setting exists in both the UI and
  netlify.toml, **netlify.toml wins**.
- `[build]`: `base`, `publish`, `command`, `environment` (build env vars), `processing`; also
  `ignore` (custom ignore-build command - exit-code semantics (unconfirmed), not captured).
- `[context.production]`, `[context.deploy-preview]`, `[context.branch-deploy]`: per-context overrides
  of the same keys, e.g. `environment = { NODE_VERSION = "22" }`.
- `[functions]`: `directory` (default `<base>/netlify/functions`), `node_bundler` (`esbuild`|`zisi`),
  `external_node_modules`, `included_files`; per-function `[functions."name"]` (e.g. `schedule`).
- `[[redirects]]`: `from`, `to`, `status`, `force`, `query`, `conditions`.
- `[[headers]]`: `for` + `[headers.values]` (doc 05).
- `[dev]`: `command`, `port`, `publish` for `netlify dev`.
- `netlify.toml` is on the proposal deny-list; changes are human commits reviewed by security-engineer.

## Deploy model (deploy overview)

- **Production branch**: builds the main URL. **Production deploy**: a deploy from it. With **auto
  publishing** on, each production deploy becomes the **published deploy** (the live site).
- Contexts: `production`, `deploy-preview`, `branch-deploy`, `dev`.
- **Atomic deploys**: nothing goes live until every file is uploaded; then the new version switches in
  at once - the site is never half-updated.
- **Skew protection** routes clients that still run old JS to the deploy they came from while it exists.
- Continuous deployment: pushing to the linked Git repo builds and deploys automatically. That is how
  an approved console commit redeploys the site. `netlify deploy --prod` deploys from the CLI.
- **Stop builds**: pushes no longer build production, previews or branch deploys; Trigger deploy is
  disabled. (Emergency brake if approved commits misbehave.)

## Deploy Previews

- Built automatically for each pull/merge request (GitHub, GitLab, Bitbucket, Azure DevOps, Cursor Origin).
- URL: `deploy-preview-<PR number>--<site>.netlify.app`.
- Netlify Drawer on previews for comments, screenshots, video, mobile checks.
- Fork PRs from outside the team follow the **untrusted deploys policy** (Require approval by default).
- Scheduled functions do **not** run on previews; site-wide Blobs are **shared** with production (doc 03).
- Use with the PR variant of the console: commit to `agent/<proposal-id>`, open a PR, QA on the preview.

## Rollback (manage deploys)

1. Deploys list -> open the last good deploy -> **Publish deploy**. Instant (atomic).
2. Optionally **Lock to stop auto publishing** so the next push does not replace the rollback.
3. `git revert` the bad commit on `main` so Git matches what is live; then unlock auto publishing.
4. Record the last good deploy ID for every release (netlify-engineer rule).
- Retention: deploys are deleted after **30 days** (90 on paid plans); permalinks of deleted deploys
  return 404. So "one-click rollback" only reaches back that far.
- Whether a republished old deploy runs its own functions and env values: (unconfirmed) on the pages
  read; atomic deploys suggest yes. Note: site-wide Blobs data is **not** rolled back.

## Netlify CLI

- `netlify dev` - runs the site locally on port **8888** with headers, redirects, env vars and
  Functions emulated (Blobs: sandboxed local store, per the Blobs page). `--context production` uses
  another context's settings and variables. Errors out if its ports are taken.
- `netlify link` - connect a manual clone to the site (site ID).
- `netlify functions:invoke <name>` - invoke a function (e.g. a scheduled one) while `netlify dev` runs.
- `netlify env:*` - see doc 04.
- `netlify deploy --prod` (documented on the create-deploys page); plain `netlify deploy` making a
  draft deploy is (unconfirmed) on the pages read.
- Pin the CLI version in CI (`npx netlify-cli@<version>`) to keep builds reproducible.

## Release checklist (netlify-engineer)

- [ ] Change verified on a Deploy Preview; response headers inspected (`curl -I`).
- [ ] `netlify.toml`/env/header change reviewed by security-engineer.
- [ ] Last good production deploy ID noted before merging.
- [ ] Smoke test within 5 min of publish (skill `smoke-test-rollback`); on failure publish the previous
      deploy, then `git revert`.
