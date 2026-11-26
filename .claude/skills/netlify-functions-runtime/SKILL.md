---
name: netlify-functions-runtime
description: Write Netlify Functions correctly for Flood Watch - modern signature, config, limits, streaming and background mode. Use when creating or changing anything in netlify/functions.
user-invocable: false
---
# Netlify Functions runtime

- Location: `netlify/functions/<name>.mjs`. Signature: `export default async (req, context) => new Response(...)`.
- Routing: `export const config = { path: "/api/<name>", method: "POST" }`.
- Secrets: read with `Netlify.env.get("NAME")` inside the handler; never at module top level for logging.
- Limits (Netlify docs, not configurable): synchronous execution **60 s**; buffered request/response **6 MB**; streamed response **20 MB**.
- Streaming: return a `Response` whose body is a `ReadableStream` (Server-Sent Events for chat). Still finish well under 60 s.
- Background: `config.background = true` (or `-background` filename suffix). Runs up to **15 min**, caller gets an empty **202**, Netlify retries on error after 1 min and again after 2 min → handlers must be idempotent.
- Rate limits: `config.rateLimit = { windowLimit, windowSize /* ≤180 s */, aggregateBy: ["ip","domain"] }`. Only in the function's config, not `netlify.toml`.
- Return JSON errors with correct status (400, 401, 403, 409, 429, 500); never echo stack traces or env values.
- Bundle extra files (e.g. `.claude/agents/**`) with `[functions] included_files` in `netlify.toml`.
