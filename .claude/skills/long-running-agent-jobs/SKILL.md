---
name: long-running-agent-jobs
description: Run Agent Console work that may exceed Netlify's 60-second limit - one Claude turn per request, or a background job with saved state and polling. Use when an agent task needs several tool rounds or minutes of work.
user-invocable: false
---
# Long-running agent jobs

## Default: one turn per request
Each `/api/agent-chat` call runs one Claude turn: stream text, run tool calls, save the conversation to Blobs, return. If `stop_reason` is `tool_use` (or `pause_turn`), the browser posts "continue". Each call stays far under 60 s.

## Big tasks: background job
1. `/api/agent-job` creates `jobs/<id>` = `{status:"queued", step:0}` (`onlyIfNew`) and invokes the background function.
2. Background function (≤ 15 min): load state, **if status is done/failed, exit** (retries happen after 1 and 2 min), run turns, append progress to `jobs/<id>/events`, save after every turn.
3. Guards: stop at 25 tool rounds, the job token budget, or ~13 min wall clock — save state and mark `paused` so it can resume.
4. Finish by creating one `pending` proposal (idempotent: proposal ID derived from job ID).
5. Console polls `/api/job-status?id=` every 2–3 s and renders events.

Never commit to GitHub from a job. Only the approve endpoint commits.
