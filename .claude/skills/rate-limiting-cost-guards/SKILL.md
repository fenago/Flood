---
name: rate-limiting-cost-guards
description: Protect Flood Watch Functions and Claude API spend with per-IP rate limits, token budgets and job caps. Use when adding an endpoint or anything that calls Claude or GitHub.
user-invocable: false
---
# Rate limiting and cost guards

Netlify allows only **2** code-based rate-limit rules per project on Free/Personal and **5** on Pro, and a rule may take up to ~**10 s** to start blocking (`knowledge/netlify-engineer/docs/05-headers-and-rate-limiting.md`). Design that fits every plan:
- Netlify `config.rateLimit` (window ≤ 180 s, `aggregateBy: ["ip","domain"]`) **only** on `auth-login` and `agent-chat`.
- Every other endpoint: per-IP counter in Blobs - fixed window, key `counters/<endpoint>/<ipHash>/<window>`, strong consistency, create with `onlyIfNew`, increment with `onlyIfMatch` (retry on conflict), 429 when over.

| Endpoint | Limit / 60 s | Mechanism |
|---|---|---|
| auth-login | 5 | Netlify `rateLimit` + Blobs lockout counter |
| agent-chat | 20 | Netlify `rateLimit` |
| agent-job (start) | 5 | Blobs counter |
| job-status | 60 | Blobs counter |
| proposal-approve | 5 | Blobs counter |
| proposal-reject | 5 | Blobs counter |
| agents, proposals GET | 30 | Blobs counter |

Spend guards:
- `max_tokens` on every Claude request; at most 25 tool rounds per job.
- After each response add `usage.input_tokens + usage.output_tokens` to `counters/<YYYY-MM-DD>` (strong consistency, `onlyIfMatch` retry). Refuse new chats/jobs with 429 when over `DAILY_TOKEN_BUDGET`.
- Login lockout (**required**, not optional - it covers the 10 s enforcement gap): 10 failures in 15 min → lock 15 min (counter in Blobs, keyed by IP hash).
- Client shows a friendly message on 429 with retry time; never auto-retry in a tight loop.
