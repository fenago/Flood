---
name: secrets-management
description: Keep Flood Watch secrets out of the browser, the repo and logs - env var scoping, CI checks and rotation. Use when adding a secret, an env var, logging, or reviewing a build.
user-invocable: false
---
# Secrets management

Secrets: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `CONSOLE_PASSWORD_HASH`, `SESSION_SECRET`, `VAPID_PRIVATE_KEY`.
- Set only in Netlify env vars, scope **Functions**, marked "Contains secret values". Never in `netlify.toml`, `.env` committed files, Blobs, or client code.
- No public bundler prefixes. Read with `Netlify.env.get` inside handlers.
- Never log secrets, request headers with cookies, or full Claude prompts containing them.
- CI: fail the build if `public/` or the repo matches `sk-ant-`, `github_pat_`, `ghp_`, `-----BEGIN`, or a `.env` file is tracked.
- Rotation: GitHub token every 90 days; rotate all immediately if a leak is suspected, then invalidate sessions.
- Agents and console tools must never read env vars or return them.
