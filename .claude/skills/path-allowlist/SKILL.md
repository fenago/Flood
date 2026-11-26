---
name: path-allowlist
description: Enforce which repository paths Agent Console proposals may change, with normalisation and a deny-list for privileged files. Use when validating proposals, approving commits, or changing what agents may edit.
user-invocable: false
---
# Path allow-list

Reference implementation and tests: `knowledge/security-engineer/examples/allowlist.mjs` (+ `allowlist.test.mjs`).

Allowed (writes): `public/**/*.{html,css,js,json,svg,webmanifest}`, `src/**/*.{js,mjs,css,json}`, `tests/**/*.{js,mjs,json}` (includes `tests/**/*.test.mjs`), `docs/**/*.md`.
Denied always: `netlify/**`, `netlify.toml`, `.claude/**`, `.github/**`, `package.json`, `package-lock.json`, `scripts/**`, `knowledge/**`, any `.env*`, `public/sw.js`, `public/_headers`, `public/_redirects`, `CLAUDE.md`.

Validation (run at propose **and** approve):
1. Reject if not NFC-normalised, contains `..`, `\`, `//`, leading `/`, `%`, control chars, or a hidden segment (leading `.` or `/.`). Never decode or "clean up" input.
2. Must match an allow pattern and no deny pattern (deny wins; case-sensitive; `Public/` is not `public/`). Reject case-only duplicate paths.
3. ≤ 10 files, ≤ 200 KB total, valid UTF-8, no NUL bytes.

Why deny: editing functions, build config, dependencies, agent prompts, CI or the service worker could disable every other safeguard. `knowledge/**` is denied because agents read it first and prefer it over memory, so editing it steers agent behaviour just like a prompt. `public/_headers` and `public/_redirects` are Netlify config inside the publish dir. Those changes go through human commits only. The allow-list lives in server code (`netlify/functions/lib/allowlist.mjs`), which is itself denied.
