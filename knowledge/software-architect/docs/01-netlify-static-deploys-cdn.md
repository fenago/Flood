Source: https://docs.netlify.com/deploy/deploy-overview/
Source: https://docs.netlify.com/deploy/deploy-types/deploy-previews/
Source: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/
Retrieved: 2026-11-26

# Netlify static deploys and the CDN

The public app (picker, outlook, beach score) is static files. This is what Netlify guarantees about serving them.

## 1. Atomic deploys

- "Instead of pushing individual files to Netlify, you always create a new deploy." Netlify uploads only changed files.
- "No changes go live on your site's public URL before all changes have been uploaded. Once all the changes are ready, the new version of the site immediately goes live on the CDN."
- "Atomic deploys guarantee that your site is always consistent."
- The CDN is "a network of servers around the world that delivers your site's files from the location closest to each visitor".

Design consequence: HTML, JS modules, `scoring.json` and `sw.js` from one commit always go live together. Inconsistency can only come from **client caches** (the service worker), not from the server. So the service worker cache version must change whenever app-shell files change.

## 2. Deploy contexts

| Context | Built from |
|---|---|
| `production` | the production branch set when the site was created |
| `deploy-preview` | pull/merge requests "and agent runs" |
| `branch-deploy` | other branches |

Environment variable values can differ per context (Deploy Previews docs). Use this to give previews a lower `DAILY_TOKEN_BUDGET` or a non-production `GITHUB_BRANCH`.

## 3. URLs

- Deploy Preview: `deploy-preview-<number>--<site>.netlify.app`; content updates as new commits are pushed to the PR.
- Permalink: every successful deploy gets `<deployId>--<site>.netlify.app`; "The web content at this URL never changes."
- Published deploy: "the deploy that is currently available as the live version of your site".

Design consequence: CSP and any `Origin` check in Functions must accept the preview and permalink hosts in non-production contexts, or console tests on previews will fail (unconfirmed how each context reports its URL to a function; `context.site.url` and `context.deploy.context` exist per the Functions API page - see doc 02).

## 4. Rollback and locking

- Rollback = "publish one of the previous deploys listed in the UI ... This doesn't trigger a new deploy but instead publishes a previous atomic deploy".
- "Lock to stop auto publishing" pauses production publishing; "Unlock to start auto publishing" resumes.
- Netlify Blobs site-wide stores are not part of a deploy (doc 03), so a rollback does **not** roll back stored chats, jobs or proposals. Stored JSON must stay readable by the previous deploy's code: add fields, do not rename or remove them within one release.

## 5. Skew protection

- Version skew: "the server code is updated, but some clients continue to use an older version". Netlify's skew protection "track[s] which deploy each client should communicate with and rout[es] requests to the appropriate server version."
- Relevant for us because an installed PWA can keep old JS for a long time. Our cheaper rule: Functions accept the previous request shape for one release, and the console shows "Update available - reload" when the API reports a newer version (design choice, not a Netlify feature).

## 6. Continuous deployment and the console

- Netlify builds each push to the production branch; that is how an approved console commit redeploys the site (docs/03-architecture.md section 6).
- The safer variant commits to a branch and opens a PR so a Deploy Preview exists before merge.

## 7. What this means for the design

| Need | Netlify primitive |
|---|---|
| Serve app shell fast everywhere | Static files on the CDN |
| Consistent release | Atomic deploy |
| Test before production | Deploy Preview per PR |
| Instant undo | Publish previous deploy |
| Stable link to an exact version | Deploy permalink |
