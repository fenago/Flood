# netlify-engineer examples

All values are fake test values. Node 22.

## 1. `netlify.toml` - complete example for this project

Build, `[build.environment] NODE_VERSION`, `[functions]` with `node_bundler = "esbuild"` and
`included_files = [".claude/agents/**"]`, a deploy-preview context block, `[dev]`, and security
headers for static files (CSP, nosniff, referrer, frame, `no-cache` for `/sw.js`).
Functions' paths and rate limits are deliberately NOT here: they live in each function's `config`.

**Verified** (2026-11-26; `smol-toml` 1.9.1 resolvable from the scratch dir only):
`cd <scratch>/w4 && node /home/user/Flood/knowledge/security-engineer/examples/check-headers.mjs /home/user/Flood/knowledge/netlify-engineer/examples/netlify.toml`
-> `4 header rules checked ... OK`, exit 0; a parse dump showed `build`, `functions`
(`directory`, `node_bundler`, `included_files`), `dev`, `context.deploy-preview` and 4 header rules.
Not verified against a real Netlify build (no account in this environment).

## 2. Modern function + background job - `functions/`, `memory-blobs.mjs`, `test-job.mjs`, `blobs-local-server.test.mjs`

- `functions/agent-job.mjs` - `export default async (req, context)`, `config = { path: "/api/agent-job",
  method: "POST", rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ["ip","domain"] } }`.
  Creates `jobs/<id>` with `onlyIfNew`, invokes the background function with only the job ID plus an
  HMAC signature (background payload limit is 256 KB), returns 202.
- `functions/agent-job-background.mjs` - `config = { background: true }`. Idempotent across Netlify's
  retries (1 min, then 2 min): exits if done/failed, resumes from the saved step, advances with
  `onlyIfMatch(etag)`, creates the proposal with `onlyIfNew` under an ID derived from the job ID,
  pauses at 25 steps or ~13 min. Refuses to run if a read returns no ETag.
- Logic lives in `*.core.mjs` factories so tests can call it with a `Request` and a fake `context`.
  The thin wrappers import `@netlify/blobs` and two project modules that do not exist here
  (`lib/auth.mjs`, `lib/agent-turn.mjs`), so they are syntax-checked only.

**Verified** (2026-11-26, Node v22.23.5):
- `cd /home/user/Flood && node --test knowledge/netlify-engineer/examples/test-job.mjs`
  -> `# tests 6 # pass 6 # fail 0` (401/400 paths, fail-then-retry resumes with steps `[0,1,1,2]`,
  spurious retry does no work, 3 concurrent runs give exactly one proposal and no duplicated step,
  forged signature ignored, wall-clock pause, no-ETag refusal). Ran 20 times: 20 x `fail 0`.
- `cd <scratch>/w4 && node --test /home/user/Flood/knowledge/netlify-engineer/examples/blobs-local-server.test.mjs`
  (real `@netlify/blobs` 11.1.11 + its `BlobsServer`) -> `# tests 4 # pass 4 # fail 0`.
- `node --check` passes for all five files in `functions/`.

Gotchas found while running real `@netlify/blobs` locally (recorded in `../docs/03-netlify-blobs.md`):
1. `consistency: "strong"` in a custom environment throws `BlobsConsistencyError` unless
   `uncachedEdgeURL` is set as well as `edgeURL`.
2. The local `BlobsServer` returns **no ETag on reads** (`getWithMetadata(...).etag === undefined`),
   although writes return one and `If-Match` is honoured on writes.
3. `setJSON(key, v, { onlyIfMatch: undefined })` is an **unconditional** write. Always check the etag
   exists before a conditional write. Whether production returns an ETag on every read is
   (unconfirmed) - the docs list `etag` on `getWithMetadata` - so keep the guard.
That is why `test-job.mjs` uses `memory-blobs.mjs`, a small stub with the documented semantics.

## 3. Environment variable checklist - `env-checklist.md`

Names, scopes, contexts, secret flag, owner and format for every variable; release checks
(secret flag, no `post-processing` scope, no `builds` scope for secrets, scanning on, redeploy after
change, plan caveats); CLI commands with flags confirmed on cli.netlify.com; rotation log.
Not runnable. The one command in it (`randomBytes(32).toString('base64url')`) was run: 43 chars.
