# Session management and cookie attributes

Source: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
Source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
Retrieved: 2026-11-26

Applies to: `/api/auth-login`, `/api/auth-logout`, `requireSession()` in `netlify/functions/lib/auth.mjs`,
the `sessions` Blobs store. Skill: `console-auth-sessions`.

## Session ID (OWASP)

- Entropy: at least **64 bits**; OWASP asks for at least **128 bits** when the session is stored
  server-side and prefers **160 bits or more**. Our plan: 32 random bytes = 256 bits (`crypto.randomBytes(32)`).
- Hex encoding needs at least 16 hex chars for 64 bits; we use base64url of 32 bytes (43 chars).
- The ID must be meaningless (no user data in it) and produced by a CSPRNG.
- **Regenerate on login** and on any privilege change. For us: always mint a new ID at login;
  never accept an ID the server did not create (blocks session fixation).
- Never accept a session ID from the URL or a form field - cookie only.

## Timeouts and logout (OWASP)

- Idle timeout: 2-5 min for high-value apps, 15-30 min for low-risk ones.
- Absolute timeout: OWASP gives 4-8 h for a full-day office user. Ours: `Max-Age=28800` (8 h).
- Logout must **invalidate server side** (delete `sessions/<sha256(id)>` in Blobs) *and* clear the
  cookie by sending an empty value with `Max-Age=0` / a past `Expires`.
- Our "log out everywhere" = delete every key under the `sessions` store.
- The Agent Console can commit to production, so treat it as high value: consider an idle timeout
  of ~15 min on top of the 8 h cap, and re-auth (login within 15 min or password) for Approve.

## Cookie attributes (OWASP + MDN)

| Attribute | What it does (MDN) | Our value |
|---|---|---|
| `HttpOnly` | JS cannot read it via `document.cookie` | set |
| `Secure` | sent only over `https:` (localhost excepted) | set |
| `SameSite=Strict` | sent only on same-site requests | set (OWASP: `Strict` preferred) |
| `SameSite=Lax` | also sent on cross-site top-level safe-method navigations | not used |
| `SameSite=None` | sent cross-site; **requires** `Secure` | never |
| `Path` | path that must be in the URL for the cookie to be sent | `/` |
| `Domain` | if omitted the cookie is **host-only** | omit |
| `Max-Age` / `Expires` | lifetime; if both set, **`Max-Age` wins** | `Max-Age=28800` |

- Do not rely on browser defaults for `SameSite`: MDN notes only *some* browsers default to `Lax`.
- OWASP: SameSite is defence in depth; still do CSRF checks (doc 03).

## Cookie name prefixes (MDN)

- `__Secure-`: must be set with `Secure` from an HTTPS page.
- `__Host-`: must be `Secure`, from HTTPS, **no `Domain`**, and `Path=/`. Cannot be overwritten from a
  subdomain (OWASP CSRF sheet). Recommended name: `__Host-fw_session` (the skill says `fw_session`;
  changing it is a small, safe improvement to propose).

## Server-side storage pattern for Flood Watch

1. Login OK -> `id = randomBytes(32)`; cookie value `id.HMAC(SESSION_SECRET, "session:" + id)`.
2. Blobs `sessions/<sha256(id)>` = `{ createdAt, expiresAt, lastSeenAt, ipHash }`, written with
   `onlyIfNew`. A Blobs leak then exposes no usable cookie.
3. `requireSession(req)`: parse cookie -> verify HMAC with `timingSafeEqual` (check lengths first) ->
   read the Blobs record with `consistency: "strong"` -> check `expiresAt` -> else **401**.
4. Netlify: you can set the cookie with a `Set-Cookie` response header or `context.cookies.set()`
   (Netlify Functions API). Netlify `[[headers]]` cannot set `Set-Cookie`.

## Review checklist

- [ ] New ID at every login; old one deleted.
- [ ] HMAC verified before any Blobs lookup; lookup uses strong consistency.
- [ ] Expiry enforced server-side, not just by `Max-Age`.
- [ ] Logout deletes the record and returns a clearing cookie.
- [ ] No session ID, cookie header or HMAC key in logs.

Worked example: `../examples/session-auth.mjs` (8 passing tests).
