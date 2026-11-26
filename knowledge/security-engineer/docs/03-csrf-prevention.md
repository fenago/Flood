# CSRF prevention

Source: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
Source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
Retrieved: 2026-11-26

Applies to: every state-changing console endpoint - `auth-logout`, `agent-chat`, `agent-job`,
`proposal-approve`, `proposal-reject`. Skill: `console-auth-sessions`.

## OWASP patterns

| Pattern | OWASP verdict | Notes |
|---|---|---|
| Synchronizer token | recommended (stateful) | token generated server-side per session or per request; must be unique per session, secret, unpredictable; compared to the session's copy |
| **Signed double-submit cookie** | recommended (stateless) | token is HMAC-bound to session data (e.g. session ID) with a server secret |
| Naive double-submit cookie | **"INSECURE"** | random value in a cookie + same value in a header; defeated by cookie injection from a subdomain or network position |
| Custom request header | good for APIs | e.g. `X-CSRF-Token`; server checks it is present (cross-site forms cannot add headers) |
| Origin / Referer check | defence in depth | compare source origin to target origin |
| Fetch Metadata `Sec-Fetch-Site` | "primary signal" in modern browsers | values `same-origin`, `same-site`, `cross-site`, `none` |
| `SameSite` cookies | defence in depth only | Lax only blocks unsafe methods; scoped to registrable domain, not origin; browser support varies |

Also from OWASP:
- **Never change state on GET.**
- Do not put a synchronizer token in a cookie.
- Don't trust `X-Forwarded-Host` (or similar) "merely because it is present".
- CAPTCHA is not a CSRF control.
- `__Host-` cookie prefix: cannot be overwritten from another subdomain, no `Domain`, `Path=/`, `Secure`.

## Gap in our current skill

`console-auth-sessions` says "double-submit token (non-HttpOnly cookie + X-CSRF-Token header)". As
written that is the naive form. Make it **signed and session-bound**:

```
csrf = base64url(HMAC_SHA256(SESSION_SECRET, "csrf:" + sessionId))
```

- Return it from an authenticated `GET /api/session` (or embed via the login response), keep it in
  memory in the console JS, send it as `X-CSRF-Token` on every POST.
- Server recomputes from the session ID it already verified and compares with `timingSafeEqual`.
- No extra cookie needed; a stolen token is useless without the matching session.

## Flood Watch check order for a POST (all must pass)

1. Method is POST (function `config.method` also restricts this).
2. `Origin` header equals the site origin exactly (use `context.site.url` / a configured origin; on
   Deploy Previews the origin differs - compare to the request's own deploy URL, not a hard-coded one).
3. If `Sec-Fetch-Site` is present it must be `same-origin`.
4. Valid session (doc 01).
5. `X-CSRF-Token` matches the session-bound HMAC.
6. For Approve only: recent auth (login < 15 min) or password re-entry.

Return **403** for CSRF failures (401 is for "no session"). Keep messages generic.

## Edge cases

- `Origin` can be `null` (sandboxed iframes, some redirects) - reject.
- Our CSP `frame-ancestors 'none'` stops click-jacking of the Approve button (doc 04).
- CORS: do not add `Access-Control-Allow-Origin` to `/api/*`; the console is same-origin. A permissive
  CORS header would let other sites read responses, including the CSRF token endpoint.
- Server-Sent Events from `agent-chat` are a POST-initiated stream; same checks apply before streaming.

Worked example: `checkCsrf()` and `csrfTokenFor()` in `../examples/session-auth.mjs`, with tests for
wrong origin, cross-site fetch metadata, another session's token, missing token and GET.
