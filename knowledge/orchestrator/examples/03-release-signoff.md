# Example 3 - Release sign-off record (GO / NO-GO)

Applies the `release-signoff` skill to the v1 city outlook candidate. Values below are illustrative; a real record cites real report paths, SHAs and deploy IDs.

## Candidate

| Field | Value |
|---|---|
| Goal | Ship v1 city outlook |
| Branch / PR | `feature/v1-outlook`, PR #12 |
| Commit tested | `3f9c2e1` |
| Deploy Preview tested | `https://deploy-preview-12--<site>.netlify.app` (content changes with new pushes, so the SHA above is the real identity) |
| Current production deploy (rollback target) | deploy ID `<id>`; permalink `<id>--<site>.netlify.app` |
| Reports | T10 QA report, T9 security review, T12-T14 fix reports |

## First pass - NO-GO

| Checklist line | Status | Evidence |
|---|---|---|
| Tests pass: unit, fixture, function, e2e on the preview | PASS | QA: 61 unit/fixture, 0 function (none changed), 9 e2e on 390x844 and 360x800 |
| Accessibility: axe on every page state, no Lighthouse a11y regression | **FAIL** | axe: 1 serious - stale-data banner has no accessible name (`aria-live` region empty label) |
| `security-engineer` reviewed Functions / `netlify.toml` / auth / CSP / allow-list / env changes | PASS | T9: APPROVE (`netlify.toml` CSP only) |
| No secrets in built output (`sk-ant-`, `github_pat_`, `ghp_`) | PASS | CI grep: 0 matches |
| Scoring changes reviewed by `flood-risk-scientist`, fixtures updated | PASS | T5 + T12 |
| Flood screen shows "not an official warning; follow NWS" and Open-Meteo credit | PASS | e2e asserts both strings |
| Service worker cache version bumped (app shell changed) | **FAIL** | `public/sw.js` still `fw-v0`; shell files changed |
| Rollback path known (previous deploy ID noted) | PASS | above |

**Verdict: NO-GO**

| Failing item | Fix owner | Fix |
|---|---|---|
| Stale-data banner has no accessible name | `pwa-mobile-engineer` | Label the live region; Wren's wording from docs/design/outlook-flow.md |
| SW cache version not bumped | `pwa-mobile-engineer` | Bump to `fw-v1`; confirm old caches deleted on activate |
| (re-test) | `qa-engineer` | Re-run axe and the offline e2e on the new preview SHA |

Both fixes have the same owner and touch `public/sw.js` and `src/ui/outlook.js`, so they go in one task (wave 6), then QA re-test (wave 7). `public/sw.js` is not a Function or `netlify.toml`, so no new security review is required. It is on the console deny-list, but that only matters for Agent Console proposals; this change is a normal human-reviewed commit.

## Second pass - GO

| Checklist line | Status | Evidence |
|---|---|---|
| Tests pass on the preview | PASS | QA re-run on `8a17d40`: all pass |
| Accessibility | PASS | axe: 0 violations on all 7 states |
| Security review | PASS | unchanged since `3f9c2e1` for reviewed files (`git diff 3f9c2e1 8a17d40 -- netlify.toml netlify/` empty) |
| No secrets in output | PASS | CI grep: 0 matches |
| Scoring reviewed | PASS | unchanged |
| Notice + credit visible | PASS | e2e |
| SW cache version bumped | PASS | `fw-v1`; activate deletes `fw-v0` |
| Rollback path known | PASS | deploy ID `<id>` |

**Verdict: GO** for commit `8a17d40`.

## Message to the owner

```
GO for v1 city outlook (commit 8a17d40, PR #12).
Changed: src/api/*, src/scoring/*, src/ui/*, public/index.html, manifest,
sw.js (fw-v1), netlify.toml (CSP connect-src), docs/contracts/outlook.md.
Tests: unit/fixture 63 pass, e2e 9 pass, axe 0 violations.
Security: netlify.toml CSP approved by security-engineer.
Needs you: merge PR #12. After deploy, qa-engineer runs the smoke test;
if it fails we publish deploy <id> and revert.
Open question for you: NWS asks for a User-Agent, which browsers cannot set
(api-integration-open-meteo). Keep direct browser calls (fixed decision 2)?
```

Notes on good practice shown here:
- Every line has evidence; "looks fine" is not evidence.
- NO-GO names an owner per failure, and the re-test is a separate QA task.
- A GO is tied to one commit SHA, not to a branch or preview URL.
- The owner still performs the merge/approval; the orchestrator never ships on its own.
