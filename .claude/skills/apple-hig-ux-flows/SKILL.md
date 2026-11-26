---
name: apple-hig-ux-flows
description: Design Flood Watch screens and flows following Apple Human Interface Guidelines principles - clarity, deference, depth, familiar navigation. Use when planning screens, navigation, onboarding or the install journey.
user-invocable: false
---
# HIG-style UX flows

Core screens: City picker → City outlook (flood today/next days, alerts, tide) → Beach score → Settings (units, alerts) → Agent Console (owner only).

Rules:
- Tab bar with ≤ 4 destinations (Outlook, Beach, Cities, Settings); console is not in the public tab bar.
- One primary action per screen; destructive or deploying actions need confirmation sheets.
- First run: pick city (or "Use my location"), then the outlook immediately — no long onboarding. Offer install after the second visit.
- Show official alerts at the top of the outlook, above our score.
- Familiar controls: native `select`/search, sheets for details, pull-to-refresh where supported, back always works.
- Deliver each flow as: user goal, steps, screen list, states (loading, empty, error, offline, stale), copy, and acceptance criteria for `pwa-mobile-engineer` and `qa-engineer`.
