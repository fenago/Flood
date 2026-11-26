Source: https://docs.netlify.com/build/functions/overview/
Source: https://docs.netlify.com/build/functions/api/
Source: https://docs.netlify.com/build/functions/configuration/
Source: https://docs.netlify.com/build/functions/background-functions/
Retrieved: 2026-11-26

# Netlify Functions: signature, config, limits, background mode

Functions are the only server code. They exist for the Claude API, GitHub and console auth (CLAUDE.md fixed decision 1).

## 1. Handler shape (Functions API reference)

```js
// netlify/functions/<name>.mjs
export default async (req, context) => new Response("Hello, world!");
export const config = { path: "/api/<name>", method: "POST" };
```

- `req` is a web-standard `Request`; return a web-standard `Response`.
- `context` fields: `ip`, `geo` (city, country, latitude, longitude, subdivision, timezone, postalCode), `requestId`, `cookies` (`get`, `set`, `delete`), `deploy` (`context`, `id`, `published`, `skewProtectionToken`), `site` (`id`, `name`, `url`), `waitUntil(promise)`, `params` (from `path`).
- `context.waitUntil()` extends execution "without blocking the response to the client". Useful for writing usage counters after the reply.

## 2. Config object fields

`path`, `excludedPath`, `method`, `preferStatic`, `rateLimit`, `background`, `schedule`, `region`, `memory`, `vcpu` (listed on the API reference page).

- Rate limits are set **only** here, not in `netlify.toml` (doc 04).
- `included_files` and `node_bundler = "esbuild"` are set in `netlify.toml` `[functions]` (configuration page).

## 3. Limits (configuration page, "Resource limits" table)

| Setting | Default | Configurable |
|---|---|---|
| Region | `cmh` (US East, Ohio) for sites created after 2023-10-04 | Yes |
| Memory | 1024 MB | Yes (memory or vCPU) |
| Synchronous execution | **60 s** | No |
| Scheduled execution | **30 s** | No |
| Background execution | **15 min** | No |
| Buffered request/response payload | **6 MB** | No |
| Streamed response payload | **20 MB** | No |
| Background request/response payload | **256 KB** | No |

- Node.js: the page describes Node.js 24 as the fallback default when the build's version does not qualify (unconfirmed exact rule; read the page before pinning).

## 4. Streaming

- "To stream a response, return a `ReadableStream` as the `body` of the `Response`."
- "Streaming functions have a 60-second execution limit and a 20 MB response size limit." (API reference page)
- This **resolves the "(verify)" in docs/03-architecture.md**: the 60 s limit applies to streamed responses too. Agent chat must end each streamed turn before ~50 s and tell the client to continue.

## 5. Background functions

- Available on credit-based Free, Personal, Pro, and Enterprise plans.
- Enable with `background: true` in `config` (preferred) or `[functions.<name>] background = true` in `netlify.toml`; the `-background` filename suffix "is still fully supported" but new functions "should prefer the `config.background` property".
- Up to 15 minutes. "The client receives an empty `202` response immediately." No streaming: they "don't return responses".
- Retries: on error, "a retry happens after one minute. If it fails again, another retry happens two minutes later." -> handlers must be **idempotent**.
- Results must go "to a destination other than the originating client" -> for us, Netlify Blobs; the console polls.
- Request payload to a background function is capped at **256 KB**: pass a job ID, not the conversation.

## 6. Environment variables in functions

- Documented access: `process.env.VARIABLE_NAME` (functions env-vars page). The `Netlify.env.get()` global used in our skills was **not** shown on the pages read (unconfirmed here; check the Netlify global API page before relying on it).
- Variables from `netlify.toml` are **not** available to functions. Details in doc 04.

## 7. Design rules that follow

1. One synchronous function per endpoint under `/api/*`; each declares `path`, `method` and (where the plan allows) `rateLimit`.
2. Any Claude call is one turn per request, streamed, with a server deadline (e.g. 50 s) well inside 60 s.
3. Anything longer is a background function keyed by a job ID, with state in Blobs and status polled.
4. Keep request bodies small; never send a full conversation to a background function.
5. Shared code lives in `netlify/functions/lib/` (not an endpoint).
6. Default function region `cmh` (Ohio) and site-wide Blobs default `us-east-2` (Ohio) are co-located (doc 03), so keep both defaults.
