# security-engineer knowledge

Reference notes and runnable examples for the `security-engineer` agent
(`.claude/agents/security-engineer.md`). Notes are written from official OWASP, MDN, Node.js, GitHub
and Netlify pages; anything not confirmed on those pages is marked "(unconfirmed)".

Last verified: 2026-11-26

## docs/

| File | One line |
|---|---|
| `docs/01-session-management-cookies.md` | OWASP session ID entropy, timeouts, logout, regeneration; MDN `Set-Cookie` attributes and `__Host-` prefix; our session storage pattern. |
| `docs/02-password-storage-node-crypto.md` | OWASP algorithm order and scrypt/Argon2id/PBKDF2 parameters; Node `scrypt` defaults, `maxmem` trap, `timingSafeEqual` rules. |
| `docs/03-csrf-prevention.md` | OWASP CSRF patterns (naive double-submit is insecure), Fetch Metadata, Origin checks, and our POST check order. |
| `docs/04-xss-and-csp.md` | OWASP safe/dangerous DOM sinks, CSP directives and delivery, our policies, and Netlify header limits (not applied to Functions). |
| `docs/05-secrets-and-github-token.md` | OWASP secrets lifecycle and leak response, Netlify Secrets Controller, fine-grained PAT facts and per-endpoint permissions. |
| `docs/06-path-traversal-and-prompt-injection.md` | OWASP path traversal encodings and prevention; OWASP LLM01:2025 prompt injection mitigations mapped to our controls. |

## examples/

| File | One line |
|---|---|
| `examples/README.md` | What each example shows, exact commands, "Verified" results, and findings against the repo. |
| `examples/session-auth.mjs` | scrypt hash/verify, signed session cookie, Blobs key hashing, session-bound CSRF token and checks. |
| `examples/session-auth.test.mjs` | 8 `node:test` tests for the above (all pass). |
| `examples/allowlist.mjs` | Path allow-list validator + proposal limits per the `path-allowlist` skill. |
| `examples/allowlist.test.mjs` | 42 attack/accept path cases + proposal-level cases (all pass); `--print` emits the table. |
| `examples/security-headers.toml` | CSP and security headers for static files, with a stricter `/console/*` policy. |
| `examples/check-headers.mjs` | Lints a netlify.toml's headers (no unsafe-inline/eval, frame-ancestors, https connect-src...). |

## Main findings to act on (details in the docs)

1. CSRF in `console-auth-sessions` is the naive double-submit form; make it HMAC-bound to the session (doc 03).
2. Netlify `[[headers]]` never reach Function responses; every function must set its own headers (doc 04).
3. OWASP's scrypt minimum (N=2^17) exceeds Node's default `maxmem`; raise it explicitly (doc 02).
4. The sample regexes in `docs/04-agent-console.md` reject `*.test.mjs` and miss the `//`/`%` checks (examples/README).
5. Netlify code-based rate-limit rules are capped at 2 (Free/Personal) or 5 (Pro) per project; see
   `knowledge/netlify-engineer/docs/05-headers-and-rate-limiting.md`.
