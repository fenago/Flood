---
name: console-auth-sessions
description: Implement the Agent Console password gate, signed session cookies, CSRF protection and logout. Use when building or reviewing login, session checks or any authenticated /api endpoint.
user-invocable: false
---
# Console auth and sessions

- Password: only a hash in `CONSOLE_PASSWORD_HASH` (scrypt via `node:crypto`, format `scrypt$N$r$p$salt$hash`); compare with `crypto.timingSafeEqual`.
- Login success: random 32-byte session ID; store `sessions/<sha256(id)>` `{createdAt, expiresAt, ipHash}`; cookie `fw_session=<id>.<hmac(SESSION_SECRET,id)>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`.
- Every protected function starts with `requireSession(req)`: verify HMAC, look up session (strong consistency), check expiry → else 401.
- CSRF for state-changing requests: double-submit token (non-HttpOnly cookie + `X-CSRF-Token` header) and check `Origin` matches the site.
- Approve also requires recent auth (login within 15 min) or password re-entry.
- Logout deletes the session; "log out everywhere" deletes all session keys.
- Lockout and rate limits per `rate-limiting-cost-guards`. Generic error message: "Wrong password" — no user enumeration exists, but don't leak timing or detail.
