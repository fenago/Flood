---
name: smoke-test-rollback
description: Smoke-test Flood Watch right after each production deploy, including approved agent commits, and roll back when it fails. Use after any deploy to main.
user-invocable: false
---
# Smoke test and rollback

After each production deploy (within 5 min):
1. `GET /` 200, contains app root; `GET /manifest.webmanifest` 200 valid JSON; `GET /sw.js` 200.
2. `GET /console/` 200; `GET /api/agents` 401 without session (proves auth is on).
3. Load one city with mocked-off nothing: Open-Meteo call succeeds from the page; outlook renders.
4. No console errors on load.

On failure: publish the previous deploy in Netlify immediately, revert the commit on `main` (`git revert`), mark the related proposal `rolled_back`, and report to `orchestrator` with the failing check and commit SHA.
