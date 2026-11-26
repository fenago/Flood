# Background and scheduled functions

Source: https://docs.netlify.com/build/functions/background-functions/
Source: https://docs.netlify.com/build/functions/scheduled-functions/
Source: https://docs.netlify.com/build/functions/api/
Source: https://docs.netlify.com/build/functions/configuration/
Retrieved: 2026-11-26

Skills: `long-running-agent-jobs`, `netlify-functions-runtime`, `web-push` (v2 scheduled checks).

## Background functions

- Declare with `export const config = { background: true }` or the legacy `-background` file-name
  suffix (e.g. `agent-job-background.mjs`).
- Caller immediately gets an **empty `202`**; the function keeps running up to **15 minutes**.
- The handler's return value is **discarded**; no streaming. Put results somewhere else (Blobs).
- **Retries**: if the invocation returns an error, Netlify retries **after 1 minute**, and if that
  fails, **again 2 minutes later**. So a job can run up to 3 times -> must be idempotent.
- Request/response payload limit: **256 KB** (configuration page). Send an ID, not the conversation.
- Plans: credit-based Free, Personal, Pro, and Enterprise.
- Not stated on the pages read: whether a thrown error vs a 5xx return both count as "error" for
  retries, and whether a timeout at 15 min triggers a retry - (unconfirmed). Design for both.

### Idempotent job pattern (our example)

1. Sync `/api/agent-job` writes `jobs/<id>` with `onlyIfNew`, then POSTs `{ id }` plus an HMAC
   signature to `/.netlify/functions/agent-job-background` (the URL is public - verify the signature
   and that the job exists).
2. Background run: read the job with strong consistency; **exit if `done`/`failed`**.
3. Do one step, then save `{ step: n+1, output }` with `onlyIfMatch: etag`. If the write reports
   `modified: false`, another run got there first - stop.
4. When all steps are done, create `proposals/prop_<jobId>` with `onlyIfNew` (a retry finds it already
   there), then mark the job `done`.
5. Guards: stop at 25 steps or ~13 min wall clock and mark `paused` (resumable).
6. Because a third failure leaves the job `running` forever, `/api/job-status` should mark jobs
   `failed` when `updatedAt` is older than ~20 min.
7. Never commit to GitHub from a job; only `proposal-approve` commits.

Verified locally: `../examples/test-job.mjs` (fail -> retry resumes at the failed step, spurious
retry does nothing, 3 concurrent runs -> exactly one proposal).

### Invoking it

- From a sync function: `fetch(new URL("/.netlify/functions/agent-job-background", req.url), {method:"POST", ...})`.
  Expect status 202. (Using the request's own origin keeps Deploy Previews talking to their own
  background function.)
- `context.waitUntil()` is **not** a substitute: it extends a sync function only up to its own 60 s limit.

## Scheduled functions

- Declare `export const config = { schedule: "@hourly" }` (cron string, **UTC**), or in
  `netlify.toml`: `[functions."name"] schedule = "@hourly"`.
- RFC cron extensions supported except `@reboot` and `@annually`; `@daily` = `0 0 * * *`.
- Execution limit: **30 seconds**.
- Run only on the **published** deploy - Deploy Previews and branch deploys do not trigger them.
- Cannot be invoked by URL. Request body is JSON with `next_run` (ISO-8601 time of the next run).
- `schedule` is mutually exclusive with `path`.
- Local test: run `netlify dev`, then `netlify functions:invoke <name>`.
- Available on all plans.

### Planned uses

- v2 push alerts: hourly NWS check -> send pushes (keep under 30 s; if more work is needed, have the
  scheduled function kick a background function).
- Cleanup: daily delete of `chats/` and `jobs/` older than 30 days (skill `netlify-blobs`). Paginate
  `list({ prefix })` and stop before ~25 s.

## Checklist

- [ ] Background handler: early exit on terminal status, resumes from saved state, conditional writes.
- [ ] Background payload < 256 KB (IDs only).
- [ ] Background URL cannot be abused: signature check + job must exist + rate limit on the sync starter.
- [ ] Scheduled work < 30 s; nothing assumes previews run schedules.
