---
name: github-commits-api
description: Read files and make atomic commits to fenago/Flood through the GitHub REST API from a Netlify Function, with stale-base protection. Use when writing code that reads repo files or commits approved changes.
user-invocable: false
---
# GitHub REST: read and commit

Headers: `Authorization: Bearer ${GITHUB_TOKEN}`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2026-03-10` (always send it: omitting it means `2022-11-28`; an unsupported version returns 410). Source: `knowledge/agent-console-engineer/docs/06-github-rest-commits.md`.

Read: `GET /repos/{o}/{r}/contents/{path}?ref=main` (≤ 1 MB full support; use `application/vnd.github.raw+json` for raw). List: `GET /repos/{o}/{r}/git/trees/{sha}?recursive=1`.

Atomic multi-file commit (preferred):
1. `GET /git/ref/heads/main` → `headSha`; `GET /git/commits/{headSha}` → `treeSha`.
2. If `headSha !== proposal.baseSha`, compare each proposed path's blob SHA at both commits; any difference → mark proposal `stale`, return 409.
3. `POST /git/trees` `{ base_tree: treeSha, tree: [{ path, mode: "100644", type: "blob", content }] }`.
4. `POST /git/commits` `{ message, tree, parents: [headSha] }`.
5. `PATCH /git/refs/heads/main` `{ sha: newCommit, force: false }` — 422 means main moved; retry from step 1 once.

Single file alternative: `PUT /contents/{path}` with `message`, base64 `content`, `sha` when updating, `branch`; never run in parallel with delete.

Commit message: `agent(<name>): <summary>` + trailer `Proposal-Id: <id>`. PR variant: create `agent/<id>` ref, commit there, `POST /pulls`.
