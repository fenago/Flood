# Custom headers and rate limiting

Source: https://docs.netlify.com/manage/routing/headers/
Source: https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
Source: https://docs.netlify.com/build/functions/api/
Retrieved: 2026-11-26

Skills: `netlify-config-deploy`, `rate-limiting-cost-guards`, `prompt-injection-xss-defense`.

## Custom headers

Two ways:
- `_headers` plain-text file in the **publish directory** (`public/_headers`): a path line, then
  indented `Name: value` lines; `#` comments; header names case-insensitive; repeat a name for
  multi-value headers.
- `[[headers]]` in `netlify.toml`:
  ```toml
  [[headers]]
    for = "/*"
    [headers.values]
      X-Frame-Options = "DENY"
  ```
  Multi-value headers use TOML multiline strings.

Path matching: `*` wildcard anywhere in a segment; `:placeholder` only at the start of a segment;
not both in one segment. Precedence between `_headers` and `netlify.toml`: (unconfirmed) - not on the
page; use **only `netlify.toml`** to avoid ambiguity. `public/` is agent-editable while `netlify.toml`
is denied: `public/_headers` and `public/_redirects` are rejected today only because they have no
allowed extension (checked with the example validator). Add them to the deny patterns explicitly so a
future allow-list change cannot open them.

**Custom headers apply only to files Netlify serves from its store. They do not apply to Function,
Edge Function or proxied responses.** -> every function sets its own security headers.

Headers Netlify will not let you override: `Accept-Ranges`, `Age`, `Allow`, `Alt-Svc`, `Connection`,
`Content-Encoding`, `Content-Length`, `Content-Range`, `Date`, `Location`, `Server`, `Set-Cookie`,
`Trailer`, `Transfer-Encoding`, `Upgrade`.

Our header set (full text in `../examples/netlify.toml`): CSP, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `X-Frame-Options: DENY` on `/*`; a tighter CSP + `no-store` on `/console/*`;
`Cache-Control: no-cache` on `/sw.js` so service-worker updates are picked up.

## Rate limiting (code-based, in the function's config)

```js
export const config = {
  path: "/api/auth-login",
  method: "POST",
  rateLimit: {
    windowLimit: 5,          // max requests per window
    windowSize: 60,          // seconds, maximum 180
    aggregateBy: ["ip", "domain"],
    // action: "rewrite", to: "/rate-limited.html"   // default action returns 429
  },
};
```
- Over the limit: **HTTP 429**, or a rewrite with `action: "rewrite"` + `to`.
- `aggregateBy`: `"ip"`, `"domain"`, or both. Per-domain-only (shared limit for all clients) is an
  Enterprise / HP Edge option; per domain & IP is on all plans.
- **Function rate limits cannot be declared in `netlify.toml`** (redirect rules in netlify.toml can
  carry rate limits).
- Enforcement is **not instant**: counting is off the request path, so it can take **up to 10 s**
  after crossing the threshold before blocking starts. Requests in that gap still reach the function.

### Plan limits on the number of rules - IMPORTANT for Flood Watch

| Plan | Code-based rules per project |
|---|---|
| Free (credit-based or legacy) / Starter / Personal | **2** |
| Pro (credit-based or legacy) / Enterprise | **5** |
| Enterprise with HP Edge | 100 |

`docs/04-agent-console.md` section 6 plans **8** limited endpoints (login, agents, chat, job, status,
proposals, approve, reject). That does not fit Free/Personal (2) or Pro (5). Options for the
orchestrator/owner:
1. Spend platform rules on the highest-risk endpoints: `auth-login` and `agent-chat` (Free), plus
   `agent-job`, `proposal-approve`, `job-status` (Pro).
2. Enforce the rest in code: a per-IP counter in Blobs (`counters/<endpoint>/<ipHash>/<minute>`,
   `onlyIfNew`/`onlyIfMatch`), returning 429 - which the login lockout already needs anyway.
3. Merge endpoints under one function with a multi-path `config.path` array (one rule covers them).
Because of the 10 s enforcement delay, the login lockout counter in Blobs is required, not optional.

## Checklist

- [ ] Header changes go through `netlify.toml` (security-engineer review), never `public/_headers`.
- [ ] Every function response sets `no-store`, `nosniff` and a restrictive CSP itself.
- [ ] Each function's `rateLimit` uses `windowSize <= 180`; total rules within the plan's count.
- [ ] Code-level counters exist for endpoints without a platform rule and for login lockout.
