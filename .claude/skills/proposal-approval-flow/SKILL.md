---
name: proposal-approval-flow
description: Implement the Agent Console flow from agent proposal to human approval to GitHub commit to Netlify redeploy, safely and idempotently. Use when building or changing propose, review, approve or reject behaviour.
user-invocable: false
---
# Proposal → approve → commit → redeploy

1. Agent calls `propose_change({ summary, files:[{path, content}] })`. Function validates every path with the allow-list, ≤ 10 files, ≤ 200 KB total, UTF-8 text only; stores `proposals/<id>` `{status:"pending", agent, baseSha, files, summary, createdAt}` with `onlyIfNew`.
2. Console fetches current file contents from GitHub and shows the diff.
3. Approve (`POST /api/proposal-approve`, session + CSRF): re-validate session, CSRF, allow-list and limits **again**; transition `pending → approving` with `onlyIfMatch` (409 if not pending).
4. Commit with the atomic Git Data flow; on success `committed {commitSha}`; on stale base `stale`; on error back to `pending` with `lastError`.
5. Netlify builds the push to main; console shows deploy status; `qa-engineer` smoke test runs after deploy.
- Reject: `pending → rejected` with note; agent sees the note on its next turn.
- Agents never have a commit tool. Proposals expire after 7 days.
