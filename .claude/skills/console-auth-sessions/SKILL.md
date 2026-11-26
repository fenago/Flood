---
name: console-auth-sessions
description: Implement the Agent Console password gate, signed session cookies, CSRF protection and logout. Use when building or reviewing login, session checks or any authenticated /api endpoint.
user-invocable: false
---
# Console auth and sessions

Reference implementation: `knowledge/security-engineer/examples/session-auth.mjs` (docs 01-03 in that folder).

- Password: only a hash in `CONSOLE_PASSWORD_HASH` (scrypt via `node:crypto`, format `scrypt$N$r$p$salt$hash`, OWASP row N=2^17, r=8, p=1, 16-byte salt). That needs ~128 MiB, above Node's default `maxmem` (32 MiB), so pass `maxmem` explicitly (e.g. 256 MiB) or scrypt throws. Use the async form. Bound the parsed parameters; `verifyPassword` returns false, never throws. Compare with `crypto.timingSafeEqual` (check lengths first).
- Login success: always mint a new random 32-byte session ID; store `sessions/<sha256(id)>` `{createdAt, expiresAt, lastSeenAt, ipHash}` with `onlyIfNew`; cookie `__Host-fw_session=<id>.<hmac(SESSION_SECRET,"session:"+id)>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`. The `__Host-` prefix requires `Secure`, `Path=/` and no `Domain` (MDN Set-Cookie).
- Every protected function starts with `requireSession(req)`: verify HMAC (constant time), look up session (strong consistency), check expiry server-side → else 401.
- CSRF (OWASP: naive double-submit is insecure) - use the **signed, session-bound token**: `csrf = r + "." + HMAC(SESSION_SECRET, "csrf:" + sessionId + ":" + r)`, `r` = 16 random bytes. Return it from an authenticated response, keep it in memory in the console JS, send it as `X-CSRF-Token` on every POST. The server recomputes the HMAC from the session ID it already verified and compares with `timingSafeEqual`.
- POST check order (all must pass, else 403): method is POST (never change state on GET) → `Origin` equals the site/deploy origin exactly (`null` rejected) → `Sec-Fetch-Site`, when present, is `same-origin` → valid session → valid `X-CSRF-Token`. No `Access-Control-Allow-Origin` on `/api/*`.
- Approve also requires recent auth (login within 15 min) or password re-entry.
- Logout deletes the session record and sends a clearing cookie (`Max-Age=0`); "log out everywhere" deletes all session keys.
- Lockout and rate limits per `rate-limiting-cost-guards`. Generic error message: "Wrong password" — no user enumeration exists, but don't leak timing or detail. Never log passwords, hashes, cookies or session IDs.
