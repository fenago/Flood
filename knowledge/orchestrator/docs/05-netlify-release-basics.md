Source: https://docs.netlify.com/deploy/deploy-types/deploy-previews/
Source: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/
Source: https://docs.netlify.com/deploy/deploy-overview/
Retrieved: 2026-11-26

# Netlify basics for release sign-off

Only what the orchestrator needs to sign off a release. Build and deploy settings belong to `netlify-engineer`.

## 1. Deploy Previews

- Built when a pull/merge request is opened on the connected repo (GitHub, GitLab, Bitbucket, Azure DevOps, Cursor Origin).
- URL pattern: `deploy-preview-<number>--<site>.netlify.app` (example on the page: `https://deploy-preview-1234--my-site.netlify.app`).
- The preview URL "will update as changes are pushed to the pull / merge request and successfully deployed".
- Environment variables can have different values per deploy context, including Deploy Previews.
- Sign-off rule: QA evidence must name the preview URL **and** the commit SHA it tested, because the preview URL content changes with new pushes.

## 2. Deploy contexts

- `production` - the production branch deploy.
- `deploy-preview` - pull/merge request previews ("and agent runs").
- `branch-deploy` - other branches.

## 3. Permalinks and atomic deploys

- Every successful deploy gets a permalink `<deployId>--<site>.netlify.app`; "The web content at this URL never changes."
- Deploys are atomic: "No changes go live on your site's public URL before all changes have been uploaded."
- Use the permalink of the current production deploy as the **rollback target** in the sign-off record.

## 4. Rollback

- "you can publish one of the previous deploys listed in the UI as the live version of your site in production. This doesn't trigger a new deploy but instead publishes a previous atomic deploy".
- Lock: "Lock to stop auto publishing" in the Deploys list stops new production deploys from going live; "Unlock to start auto publishing" reverses it.
- After a rollback the bad commit is still on `main`; a `git revert` is needed so the next deploy does not bring it back (see `smoke-test-rollback` skill).
- Netlify Blobs data is **not** rolled back with a deploy (site-wide stores persist across deploys). A release that changes stored data shapes needs a compatible-read plan (unconfirmed as an explicit statement on these pages; inferred from the Blobs page saying site-wide data persists across deploys).

## 5. Skew protection

- Netlify offers skew protection so clients on an old deploy keep talking to the matching server version (deploy overview page). Relevant if an API shape changes while users keep a cached PWA open.

## 6. What the orchestrator records at sign-off

| Field | Example |
|---|---|
| Release candidate commit | `abc1234` |
| Preview URL tested | `deploy-preview-12--<site>.netlify.app` |
| Current production deploy ID (rollback target) | from Deploys list |
| QA report reference | file path or message |
| Security review reference | required when Functions, auth, CSP, `netlify.toml`, allow-list or env vars changed |
| Verdict | `GO` / `NO-GO` with owners of fixes |
