---
name: accessibility-testing
description: Test Flood Watch accessibility automatically with axe and Lighthouse and manually with VoiceOver, TalkBack, keyboard and zoom. Use when verifying any UI change.
user-invocable: false
---
# Accessibility testing

Automated (every PR, on the deploy preview):
- `@axe-core/playwright` on every page **and state**: first run, outlook (each risk level), beach, offline banner, error, console login, chat, diff, confirmation sheet. Zero serious/critical violations.
- Lighthouse CI `--only-categories=performance,accessibility,best-practices,seo`; fail on accessibility regressions.
- Contrast test over `tests/contrast.json` token pairs.

Manual (each release): VoiceOver on iPhone, TalkBack on Android, keyboard-only on desktop, 200% zoom and 320 px reflow, reduced motion/transparency on, outdoor brightness check. Record results in `tests/a11y/RESULTS.md`.

Automated tools catch only part of WCAG issues — manual checks are required, not optional.
