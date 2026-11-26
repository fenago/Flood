# Environment variable checklist (Flood Watch)

Source: https://docs.netlify.com/build/environment-variables/overview/ , https://docs.netlify.com/build/functions/environment-variables , https://docs.netlify.com/build/environment-variables/secrets-controller , https://cli.netlify.com/commands/env/
Retrieved: 2026-11-26

Names, scopes and owners only. **Never write a value here, in the repo, in netlify.toml or in a log.**

## The variables

| Name | Scope | Contexts | Secret? | Set by | Format / how to make it |
|---|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | functions | production, deploy-preview | yes | owner | Claude Console key; use a separate low-limit key for previews if possible |
| `GITHUB_TOKEN` | functions | production (+ deploy-preview only if previews may commit) | yes | owner | fine-grained PAT, `fenago/Flood` only, Contents R/W, 90-day expiry |
| `GITHUB_REPO` | functions | all | no | netlify-engineer | `fenago/Flood` |
| `GITHUB_BRANCH` | functions | production: `main`; deploy-preview: a staging branch | no | netlify-engineer | branch name |
| `CONSOLE_PASSWORD_HASH` | functions | production, deploy-preview | yes | owner | `scrypt$131072$8$1$<salt>$<hash>` (see security-engineer example) |
| `SESSION_SECRET` | functions | production, deploy-preview (different values) | yes | owner | 32 random bytes, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `DAILY_TOKEN_BUDGET` | functions | all | no | owner | integer, e.g. `2000000` |
| `NWS_USER_AGENT` | functions | all | no | netlify-engineer | `FloodWatch (contact via site)` - no personal email |
| `NODE_VERSION` | builds | all | no | netlify-engineer | `22` (may live in netlify.toml `[build.environment]`) |

## Rules to check before every release

- [ ] Every secret row has **Contains secret values** ticked (CLI: `--secret`). Secrets are then write-only: nobody can read them back from the UI, CLI or API.
- [ ] Every secret has explicit contexts and scopes. Netlify requires explicit contexts/scopes for secrets and **forbids the `post-processing` scope** for them (it could leak through snippet injection).
- [ ] No secret has the `builds` scope - the build never needs one, and a build-scoped secret can end up in build output.
- [ ] Nothing secret is in `netlify.toml` (those variables are build-only anyway and also *override* UI values of the same name).
- [ ] No public bundler prefix (`VITE_`, `PUBLIC_`, `NEXT_PUBLIC_`) on any name.
- [ ] Secret scanning is **on**: `SECRETS_SCAN_ENABLED` is unset or `true`; `SECRETS_SCAN_OMIT_KEYS` / `SECRETS_SCAN_OMIT_PATHS` are empty unless security-engineer approved an entry.
- [ ] Sizes: keys up to 255 chars, values up to 5,000 chars. Functions values should also fit AWS limits (4 KB total for all variables in Lambda compatibility mode). Our set is well under 1 KB (names plus ~108-char API key, ~93-char PAT, 87-char hash, 43-char secret).
- [ ] After any change: **trigger a new deploy** - functions use the values from deploy time.
- [ ] Plan check: per-scope settings for functions are documented as Pro and above; Secrets Controller as Personal, Pro, Enterprise. On the Free plan confirm what the UI allows before relying on scope isolation (unconfirmed for this site's plan).
- [ ] Public repo? Set the untrusted-deploys policy to **Require approval** (default) or **Build without sensitive variables** so fork PRs never see secrets.

## CLI commands (flags confirmed on cli.netlify.com)

```bash
# Values typed on a command line land in shell history. Prefer the UI for secrets,
# or start the line with a space where HISTCONTROL=ignorespace is set.
netlify env:set GITHUB_REPO fenago/Flood --scope functions
netlify env:set GITHUB_BRANCH main --scope functions --context production
 netlify env:set SESSION_SECRET "<paste>" --scope functions --context production --secret
netlify env:list --scope functions --context production   # secret values are masked
netlify env:set ANTHROPIC_API_KEY --secret                 # convert an existing variable to secret
netlify env:unset OLD_NAME --context production
```

## Rotation log (names and dates only)

| Name | Last rotated | Next due | Note |
|---|---|---|---|
| `GITHUB_TOKEN` | YYYY-MM-DD | +90 days | fine-grained PAT expiry |
| `SESSION_SECRET` | YYYY-MM-DD | on suspicion | rotating logs everyone out |
| `ANTHROPIC_API_KEY` | YYYY-MM-DD | on suspicion | |

Leak response (OWASP order): revoke -> rotate -> delete -> log, then redeploy and invalidate sessions.
