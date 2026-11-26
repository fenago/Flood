Source: https://docs.github.com/en/rest/repos/contents
Source: https://docs.github.com/en/rest/git/refs
Source: https://docs.github.com/en/rest/git/trees
Source: https://docs.github.com/en/rest/git/commits
Source: https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api
Source: https://docs.github.com/en/rest/about-the-rest-api/api-versions
Source: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
Retrieved: 2026-11-26

# GitHub REST: reading files and atomic commits

## Headers on every request

```
Authorization: Bearer <GITHUB_TOKEN>          (from Netlify.env, Functions scope only)
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
User-Agent: flood-watch-agent-console
```

- Supported API versions: **`2026-03-10`** and `2022-11-28`. Omitting the header means `2022-11-28`. A version stays supported at least 24 months after its successor ships. Unsupported version -> **410 Gone**.
- `Authorization: Bearer` or `token` both work for PATs; JWTs need `Bearer`.
- Bad token -> 401. Missing permission -> 404 **or** 403 (GitHub hides private resources). Treat 404 on a known path as "check token scope".
- User-Agent is required by GitHub generally (unconfirmed - not stated on the auth page we read); we send one anyway.
- Our repo skill `github-commits-api` says "pinned `X-GitHub-Api-Version`" without a value; this note pins `2026-03-10`.

## Read

| Call | Notes |
|---|---|
| `GET /repos/{owner}/{repo}/contents/{path}?ref={sha or branch}` | File JSON: `type`, `encoding` (base64), `size`, `name`, `path`, `content`, `sha` (blob SHA). Permission: Contents **read**. |
| Size | <= 1 MB: full support. 1-100 MB: only `raw` (`application/vnd.github.raw+json`) or `object` media types (object gives empty `content`, `encoding: "none"`). > 100 MB: not supported. |
| `GET /repos/{o}/{r}/git/trees/{sha}?recursive=1` | File listing. Recursive results truncate past 100,000 entries / 7 MB (`truncated: true`). |

## Atomic multi-file commit (Git Data API)

| Step | Call | Body / result | Status codes |
|---|---|---|---|
| 1 | `GET /repos/{o}/{r}/git/ref/heads/main` (singular `ref`) | `object.sha` = head commit | 200, 404, 409 |
| 2 | `GET /repos/{o}/{r}/git/commits/{head}` | `tree.sha` | 200, 404, 409 |
| 3 | stale check | compare each proposed path's blob `sha` at `baseSha` and `head` via contents `?ref=` | - |
| 4 | `POST /repos/{o}/{r}/git/trees` | `{ base_tree, tree: [{ path, mode: "100644", type: "blob", content }] }` -> `sha`. `sha: null` deletes a path. Modes: `100644`, `100755`, `040000`, `160000`, `120000` | 201, 403, 404, 409, 422 |
| 5 | `POST /repos/{o}/{r}/git/commits` | `{ message, tree, parents: [head] }` (+ optional `author`, `committer`, `signature`) -> `sha` | 201, 404, 409, 422 |
| 6 | `PATCH /repos/{o}/{r}/git/refs/heads/main` (plural `refs`) | `{ sha, force: false }` (`force` defaults to false = fast-forward only) | 200, 409, 422 |

- 422 on step 6 = not a fast-forward (main moved). Start again from step 1 once; if the proposed files changed, mark the proposal `stale` and return 409 to the console.
- Unsigned API commits show `verification.verified: false, reason: "unsigned"`.
- Write permissions (fine-grained token): Contents **write** for trees/commits/refs. Changing files under `.github/workflows/` also needs Workflows write - our token must **not** have it (and `.github/` is deny-listed).
- Verified flow: `examples/03-github-atomic-commit/` (mock server).

## Single-file alternative

`PUT /repos/{o}/{r}/contents/{path}` with `message`, base64 `content`, `sha` (required when updating; blob SHA of the file being replaced), `branch`, optional `committer`/`author`. Returns `content` and `commit`. 409 conflict, 422 validation. Do **not** run it in parallel with "Delete a file" - the docs say concurrent calls conflict; run serially. One commit per file, so prefer the Git Data flow for proposals.

## Rate limits

- Authenticated (PAT, fine-grained PAT, App): 5,000 requests/hour (15,000 for Enterprise Cloud orgs). Unauthenticated: 60/hour.
- Secondary: <= 100 concurrent requests; <= 900 points/min for REST; <= 80 content-creating requests/min and <= 500/hour.
- Headers: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-used`, `x-ratelimit-reset` (UTC epoch seconds), `x-ratelimit-resource`.
- Over a limit: 403 or 429. If `retry-after` is present wait that many seconds; if `x-ratelimit-remaining` is 0 wait until `x-ratelimit-reset`; otherwise wait at least 1 minute, then back off exponentially and give up after a few tries.
- One approval = about 6 + 2N requests (N files when the base moved). Well inside limits; fetch files serially, not in a burst.

## Commit message convention (repo skill)

`agent(<name>): <summary>` then a blank line and trailer `Proposal-Id: <id>`.
