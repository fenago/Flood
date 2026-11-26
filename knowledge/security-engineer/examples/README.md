# security-engineer examples

All values are fake test values. Node 22, no packages except where stated.

## 1. Password hash + session cookie + CSRF - `session-auth.mjs`, `session-auth.test.mjs`

scrypt hash in the skill's `scrypt$N$r$p$salt$hash` format with OWASP's first scrypt row
(N=2^17, r=8, p=1), constant-time verify with `timingSafeEqual`, 256-bit session ID,
HMAC-signed cookie value, Blobs key = SHA-256 of the ID, cookie attributes, and a
session-bound CSRF token plus `Origin` / `Sec-Fetch-Site` checks.

**Verified** (2026-11-26, Node v22.23.5):
`cd /home/user/Flood && node --test knowledge/security-engineer/examples/session-auth.test.mjs`
-> `# tests 8 # pass 8 # fail 0`, ~2.7 s (scrypt N=2^17 takes ~0.3 s per hash).
One test proves Node's default `maxmem` (32 MiB) throws for N=2^17, which is why the code raises it.

Deliberate differences from `.claude/skills/console-auth-sessions/SKILL.md` (raise with orchestrator):
- Cookie name `__Host-fw_session` instead of `fw_session`: the `__Host-` prefix makes the browser
  enforce `Secure`, `Path=/` and no `Domain` (MDN, OWASP Session + CSRF cheat sheets).
- CSRF token is `HMAC(SESSION_SECRET, "csrf:" + sessionId)` instead of a free-standing random
  double-submit cookie. OWASP calls the naive double-submit pattern "INSECURE"; the signed,
  session-bound variant is its recommendation. The token can be returned by `/api/session` and
  sent in `X-CSRF-Token`; no extra cookie is needed.

## 2. Path allow-list validator - `allowlist.mjs`, `allowlist.test.mjs`

Implements `.claude/skills/path-allowlist/SKILL.md`: reject-first checks, allow patterns,
deny patterns, and proposal limits (<= 10 files, <= 200 KB, text only, no NUL, no lone surrogates,
no case-only duplicates).

**Verified** (2026-11-26):
`cd /home/user/Flood && node --test knowledge/security-engineer/examples/allowlist.test.mjs`
-> `# tests 2 # pass 2 # fail 0` (41 path cases + 8 proposal-level cases).
Print the table: `node knowledge/security-engineer/examples/allowlist.test.mjs --print`.

| Input | Result |
|---|---|
| `public/index.html`, `public/config/scoring.json`, `public/icons/icon-192.svg`, `public/manifest.webmanifest`, `src/scoring/flood.mjs`, `tests/scoring/flood.test.mjs`, `docs/decisions.md` | ACCEPT |
| `../netlify.toml`, `public/../netlify.toml`, `public/..\netlify.toml`, `public/..%2fnetlify.toml`, `public/..%c0%afx.js` | dot-dot |
| `public\index.html` | backslash |
| `public/%2e%2e/netlify.toml`, `public/%252e%252e%255cx.js` | percent-encoding |
| `/etc/passwd`, `/public/index.html` | absolute |
| `public//index.html` | empty segment |
| `docs/a.md<NUL>.js`, `docs/a<LF>b.md` | control char |
| `.env`, `public/.env.js`, `.claude/agents/orchestrator.md`, `.github/workflows/ci.yml` | hidden segment |
| `netlify.toml`, `netlify/functions/lib/allowlist.mjs`, `package.json`, `package-lock.json`, `scripts/build-agents-manifest.mjs`, `public/sw.js`, `CLAUDE.md` | denied path |
| `Public/index.html`, `src/x.JS`, `public/index.html ` (trailing space), `publіc/index.html` (Cyrillic i), `public/evil.php`, `public/`, `README.md` | not on allow-list |
| `docs/cafe` + U+0301 (NFD) | not NFC |
| empty string | empty |

Findings against the repo (for orchestrator / agent-console-engineer):
- The sample regexes in `docs/04-agent-console.md` section 4.4 reject `tests/scoring/flood.test.mjs`
  (no dot allowed in names) - checked: `false`. This example allows dots *inside* a segment only.
- The sample `allowed()` in docs/04 lacks the skill's `//`, `%`, control-char and hidden-segment
  checks; its character class also accepts `public//index.html` (checked: `true`). Use the skill's
  full list, as here.

## 3. CSP and security headers - `security-headers.toml`, `check-headers.mjs`

See `../docs/04-xss-and-csp.md` for the reasoning behind each directive. Key points:
- `script-src 'self'` with no `'unsafe-inline'`/`'unsafe-eval'`; `object-src 'none'`; `base-uri 'none'`;
  `frame-ancestors 'none'` (header-only: does not work in `<meta>`).
- `connect-src` lists exactly the five https API hosts the browser calls; the console gets `'self'` only.
- Netlify `[[headers]]` do **not** apply to Function responses and cannot set `Set-Cookie`, so every
  function adds its own headers (`no-store`, `nosniff`, `default-src 'none'; frame-ancestors 'none'`).

**Verified** (2026-11-26; needs `smol-toml` resolvable from the current directory, installed only in scratch):
`cd <scratch>/w4 && node /home/user/Flood/knowledge/security-engineer/examples/check-headers.mjs /home/user/Flood/knowledge/security-engineer/examples/security-headers.toml`
-> `3 header rules checked ... OK`, exit 0. Same file with `'unsafe-inline'` added -> `PROBLEMS: /*: unsafe-inline/eval present ...`, exit 1.
The netlify-engineer example `netlify.toml` also passes (`4 header rules checked ... OK`).
