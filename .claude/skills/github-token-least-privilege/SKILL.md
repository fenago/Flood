---
name: github-token-least-privilege
description: Create, scope, store and rotate the fine-grained GitHub token the Agent Console uses to commit to fenago/Flood. Use when setting up or reviewing GitHub access.
user-invocable: false
---
# Least-privilege GitHub token

Create: GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
- Resource owner: `fenago`. Repository access: **Only select repositories → Flood**.
- Permissions: **Contents: Read and write** (Metadata read is automatic). Add **Pull requests: Read and write** only for the PR flow.
- Do **not** grant Workflows, Administration, Secrets, Actions or any account/org permission — without Workflows the token cannot change `.github/workflows`.
- Expiration: 90 days; calendar reminder to rotate.
- Store as `GITHUB_TOKEN` in Netlify (Functions scope, secret). Never in the repo or browser.
- Consider branch protection on `main` plus the PR flow once there are other contributors. Consider a GitHub App if more repos are added (50-token limit per user).
