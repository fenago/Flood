---
name: netlify-functions-runtime
description: Write Netlify Functions correctly for Flood Watch - modern signature, config, limits, streaming and background mode. Use when creating or changing anything in netlify/functions.
user-invocable: false
---
# Netlify Functions runtime

Detail and sources: `knowledge/netlify-engineer/docs/01`, `02`, `04`, `05`.

- Location: `netlify/functions/<name>.mjs`. Signature: `export default async (req, context) => new Response(...)`.
- Routing: `export const config = { path: "/api/<name>", method: "POST" }`.
- Secrets: read inside the handler with `process.env.NAME` (documented) or `Netlify.env.get("NAME")` (unconfirmed in Netlify docs; `process.env` is documented). Never at module top level, never logged.
- Env vars: only UI/CLI/API variables with the **Functions** scope reach functions; variables declared in `netlify.toml` are **not** available to Functions. Values are fixed at deploy time - redeploy after any change.
- Limits (Netlify docs, not configurable): synchronous execution **60 s**; buffered request/response **6 MB**; streamed response **20 MB**; background request/response **256 KB**.
- Streaming: return a `Response` whose body is a `ReadableStream` (Server-Sent Events for chat). Streaming keeps the **60 s** limit (confirmed) - finish well under it.
- Background: `config.background = true` (or `-background` filename suffix). Runs up to **15 min**, caller gets an empty **202**, return value discarded, Netlify retries on error after 1 min and again after 2 min → handlers must be idempotent. Pass only a job ID (256 KB payload cap); keep all state in Blobs.
- Security headers: `[[headers]]` in `netlify.toml` do **not** apply to Function responses. Every function sets its own via one shared helper (`netlify/functions/lib/http.mjs`): restrictive CSP (`default-src 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cache-Control: no-store` for `/api/*`. Example: `knowledge/netlify-engineer/examples/functions/lib/http.mjs`.
- Rate limits: `config.rateLimit = { windowLimit, windowSize /* ≤180 s */, aggregateBy: ["ip","domain"] }`. Only in the function's config, not `netlify.toml`; plans allow few rules - see `rate-limiting-cost-guards`.
- Return JSON errors with correct status (400, 401, 403, 409, 429, 500); never echo stack traces or env values.
- Bundle extra files (e.g. `.claude/agents/**`) with `[functions] included_files` in `netlify.toml`.
