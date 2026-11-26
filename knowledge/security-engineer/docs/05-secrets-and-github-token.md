# Secrets management and the fine-grained GitHub token

Source: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
Source: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
Source: https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure
Source: https://docs.netlify.com/build/environment-variables/secrets-controller
Retrieved: 2026-11-26

Secrets: `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `CONSOLE_PASSWORD_HASH`, `SESSION_SECRET`
(`VAPID_PRIVATE_KEY` in v2). Skills: `secrets-management`, `github-token-least-privilege`.

## OWASP Secrets Management - what applies to us

- **Least privilege** (s2.3): fine-grained access per secret and consumer.
- **Rotation** (s2.7.2): rotate regularly so stolen credentials work only briefly.
- **Revocation** (s2.7.3): revoke when no longer needed or possibly compromised.
- **Expiration** (s2.7.4): create secrets that expire where possible (GitHub PAT: yes).
- **Env var caveat** (s5.1): env vars are visible to all processes and can end up in logs or dumps;
  OWASP does not recommend them "unless the other methods are not possible". On Netlify they are the
  only option (fixed decision 4), so compensate: Functions scope only, secret flag, never log `process.env`.
- **CI/CD** (s3.2.1): avoid long-lived, widely scoped credentials in pipeline variables.
- **Detection** (s8): scan before commit (pre-commit hook/IDE) and in CI; never log secrets - mask them.
- **Leak response** (s9.2), in order: **1. Revocation, 2. Rotation, 3. Deletion, 4. Logging**.

Netlify adds (Secrets Controller page): secret values are **write-only** after saving; must have
explicit contexts and scopes; may **not** use the `post processing` scope; secret scanning checks the
repo and build output (plaintext, base64 and URI-encoded forms) and **fails the build** on a match;
controls: `SECRETS_SCAN_ENABLED` (default true), `SECRETS_SCAN_OMIT_KEYS`, `SECRETS_SCAN_OMIT_PATHS`,
`SECRETS_SCAN_SMART_DETECTION_ENABLED`. Availability: Personal, Pro, Enterprise plans.
Treat any request to set an `OMIT` variable or disable scanning as a security review item.

## Fine-grained PAT - facts from GitHub docs

- Each token is limited to **one resource owner** (user or org) and optionally **selected repositories**.
- Permissions are granular; organisation owners can require approval of fine-grained tokens.
- Limit: **50** fine-grained tokens per user.
- Expiry: chosen at creation; "infinite" allowed unless an org/enterprise maximum-lifetime policy
  blocks it. Pick **90 days** (skill). GitHub auto-removes PATs **unused for a year**.
- Always includes read-only access to all **public** repos on GitHub.
- Cannot: contribute to repos where the user is only an outside collaborator, access several orgs at
  once, use Packages, call the Checks API.
- Creation path: Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens ->
  Generate new token -> name, expiration, description, resource owner, repository access
  (Only select repositories -> Flood), permissions -> Generate.
- Prefix `github_pat_` (used by our CI grep): (unconfirmed on the pages read).

## Endpoints we call and the permission they need (permissions page, "Contents" section)

| Endpoint | Permission |
|---|---|
| `PUT /repos/{o}/{r}/contents/{path}` | Contents: write (page also lists it under Workflows: write - needed only if the path is a workflow file) |
| `DELETE /repos/{o}/{r}/contents/{path}` | Contents: write |
| `POST /repos/{o}/{r}/git/blobs` | Contents: write |
| `POST /repos/{o}/{r}/git/trees` | Contents: write |
| `POST /repos/{o}/{r}/git/commits` | Contents: write |
| `POST /repos/{o}/{r}/git/refs` (branch for PR flow) | Contents: write (also listed under Workflows) |
| `PATCH /repos/{o}/{r}/git/refs/{ref}` | Contents: write (also listed under Workflows) |
| `POST /repos/{o}/{r}/pulls` (PR variant) | Pull requests: write |
| `PUT /repos/{o}/{r}/pulls/{n}/merge` | Contents: write |
| GET contents / git ref / git trees | Contents: read (read rows not captured in our extract - (unconfirmed)) |

Reading the "also listed under Workflows" rows: **without Workflows permission** GitHub refuses ref
updates and file writes that touch `.github/workflows/*`. That is a second lock behind our allow-list.

## Token settings for Flood Watch

Resource owner `fenago`; Only select repositories -> `Flood`; **Contents: Read and write** (Metadata
read is automatic); **Pull requests: Read and write** only for the PR flow. **No** Workflows,
Administration, Secrets, Actions, or account permissions. 90-day expiry + calendar reminder.

## GitHub credential hygiene (keeping-your-api-credentials-secure)

- Prefer fine-grained PATs over classic; minimum permissions; shortest workable expiry.
- Never push credentials to any repo, even private; never hard-code them.
- Don't pass tokens as plain command-line arguments or via chat/email.
- Use secret scanning / push protection on the repo.
- If leaked: generate a new credential, replace it everywhere, **delete the old one**.

## Review checklist

- [ ] No secret in `public/`, the repo, `netlify.toml`, Blobs, logs or error bodies.
- [ ] No secret has `builds` or `post-processing` scope; all are "Contains secret values".
- [ ] CI greps `public/` and the tree for `sk-ant-`, `github_pat_`, `ghp_`, `-----BEGIN`, tracked `.env`.
- [ ] Agents and console tools cannot read env vars (no such tool exists).
- [ ] After rotating `SESSION_SECRET`: all sessions die (expected). After any rotation: redeploy.
