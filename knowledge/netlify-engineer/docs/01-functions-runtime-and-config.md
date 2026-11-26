# Netlify Functions: runtime, API and configuration

Source: https://docs.netlify.com/build/functions/api/
Source: https://docs.netlify.com/build/functions/configuration/
Source: https://docs.netlify.com/build/functions/get-started/
Retrieved: 2026-11-26

Skill: `netlify-functions-runtime`. Tip from the docs: append `.md` to any docs.netlify.com URL for a
Markdown version.

## Signature (Functions API reference)

```js
export default async (req, context) => new Response("Hello, world!");   // req = web Request
// or a "Fetchable module":  export default { fetch(req, context) { ... } }
export const config = { path: "/api/agent-chat", method: "POST" };
```
- Files live in `netlify/functions/` (default `YOUR_BASE_DIRECTORY/netlify/functions`; file-based config page).
- Without `config.path` a function is reachable at `/.netlify/functions/<name>` (widely documented;
  not stated on the API page itself - (unconfirmed) there).
- Types and helpers: `npm install @netlify/functions` (`Context`, `Config`, `getContext()`).
- Lambda-style handlers can be wrapped with `withLambda()` from `@netlify/aws-lambda-compat`.

## `context` object

| Property | Content |
|---|---|
| `account.id` | team ID |
| `cookies.get(name)` / `.set(options)` / `.delete(name or options)` | CookieStore-style helpers on request/response |
| `deploy.context`, `.id`, `.published`, `.skewProtectionToken` | deploy info; `published` = is this the live deploy |
| `geo` | city, country {code,name}, subdivision, latitude, longitude, timezone, postalCode |
| `ip` | client IP string (use for rate-limit/lockout keys; hash before storing) |
| `params` | values from `path` placeholders, e.g. `/pets/:name` |
| `requestId` | Netlify request ID - safe to log |
| `server.region` | e.g. `us-east-1` |
| `site.id`, `.name`, `.url` | site metadata (`url` is the main address, not the preview URL) |
| `user` | Netlify user for private/team-login projects only; deployed on/after 2026-10-05; not in CLI |
| `waitUntil(promise)` | keep running after the response is sent, up to the execution limit; billed duration includes it |

## `config` object

| Key | Type / notes |
|---|---|
| `path` | `string \| string[]`, must start with `/`; mutually exclusive with `schedule` |
| `excludedPath` | `string \| string[]` |
| `method` | `GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`OPTIONS` or array; unset = all methods |
| `preferStatic` | only run when no static file matches |
| `rateLimit` | `{ action: "rate_limit"\|"rewrite", to, windowSize, windowLimit, aggregateBy }` (doc 05) |
| `background` | `true` = background mode (doc 02) |
| `schedule` | cron expression; function then takes no web requests (doc 02) |
| `memory` / `vcpu` | e.g. `2048` or `"2gb"`; vCPU 0.5-2; mutually exclusive |
| `region` | airport code, e.g. `"iad"` |

## Limits (configuration page, defaults table)

| Setting | Default | Configurable |
|---|---|---|
| Region | `cmh` (US East, Ohio) | yes |
| Memory | 1024 MB | yes |
| Synchronous execution | **60 s** | no |
| Scheduled execution | **30 s** | no |
| Background execution | **15 min** | no |
| Buffered request/response payload | **6 MB** | no |
| Streamed response payload | **20 MB** | no |
| Background request/response payload | **256 KB** | no |

The API page confirms streaming functions keep the **60 s** execution limit and the 20 MB size limit
(this closes the "(verify for streamed responses)" note in `docs/03-architecture.md`).

## Streaming

Return `new Response(readableStream, { headers: { "content-type": "text/event-stream" } })`.
Background functions cannot stream (they return nothing).

## Environment variables in functions

- Docs: read with `process.env.NAME`. The skills use `Netlify.env.get("NAME")`; that global is not
  described on the pages read here - (unconfirmed). Safe pattern used in our example:
  `globalThis.Netlify?.env?.get?.(name) ?? process.env[name]`, called **inside** the handler.
- Values are fixed at deploy time - redeploy after changing them (doc 04).

## Bundling (`[functions]` in netlify.toml)

`directory`, `node_bundler = "esbuild"` (or `zisi`), `external_node_modules` (copied unbundled; esbuild
only), `included_files` (extra paths/globs in the bundle - we need `.claude/agents/**`), per-function
blocks `[functions."name"]`. Node runtime version: `AWS_LAMBDA_JS_RUNTIME` (named on the configuration
page; accepted values (unconfirmed) - check the "Node.js version for runtime" section before using).

## Flood Watch conventions

- Every endpoint: `path: "/api/<name>"`, explicit `method`, JSON errors with the right status
  (400/401/403/409/429/500), never stack traces or env values.
- Netlify `[[headers]]` do not reach function responses: set `cache-control: no-store`,
  `x-content-type-options: nosniff` and a `default-src 'none'` CSP in every response
  (`../examples/functions/lib/http.mjs`).
- Keep each sync call well under 60 s: one Claude turn per request (skill `long-running-agent-jobs`).
