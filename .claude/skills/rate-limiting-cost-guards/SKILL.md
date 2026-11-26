---
name: rate-limiting-cost-guards
description: Protect Flood Watch Functions and Claude API spend with per-IP rate limits, token budgets and job caps. Use when adding an endpoint or anything that calls Claude or GitHub.
user-invocable: false
---
# Rate limiting and cost guards

Per-IP limits in each function's `config.rateLimit` (window ≤ 180 s):
| Endpoint | Limit / 60 s |
|---|---|
| auth-login | 5 |
| agent-chat | 20 |
| agent-job (start) | 5 |
| job-status | 60 |
| proposal-approve | 5 |
| agents, proposals GET | 30 |

Spend guards:
- `max_tokens` on every Claude request; at most 25 tool rounds per job.
- After each response add `usage.input_tokens + usage.output_tokens` to `counters/<YYYY-MM-DD>` (strong consistency, `onlyIfMatch` retry). Refuse new chats/jobs with 429 when over `DAILY_TOKEN_BUDGET`.
- Login lockout: 10 failures in 15 min → lock 15 min (counter in Blobs).
- Client shows a friendly message on 429 with retry time; never auto-retry in a tight loop.
