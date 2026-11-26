---
name: release-signoff
description: Go/no-go checklist before Flood Watch changes reach production on Netlify. Use when deciding whether a branch, deploy preview, or approved agent change is ready to ship.
user-invocable: false
---
# Release sign-off

Ship only when every line is true:

- [ ] Tests pass: unit, fixture, function, end-to-end on the deploy preview (`qa-engineer` report attached).
- [ ] Accessibility checks pass (axe on every page state, no new Lighthouse accessibility regressions).
- [ ] `security-engineer` reviewed any change to `netlify/functions/`, `netlify.toml`, auth, CSP, the allow-list or env vars.
- [ ] No secrets in the built output (CI grep for `sk-ant-`, `github_pat_`, `ghp_`).
- [ ] Flood/beach scoring changes reviewed by `flood-risk-scientist`, with fixture tests updated.
- [ ] The flood screen still shows the "not an official warning; follow NWS" notice and Open-Meteo credit line.
- [ ] Service worker cache version bumped if app-shell files changed.
- [ ] Rollback path known: previous Netlify deploy ID noted.

Verdict format: `GO` or `NO-GO`, then the failing items and the owner of each fix.
