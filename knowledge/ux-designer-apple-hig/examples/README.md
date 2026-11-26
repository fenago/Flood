# Wren examples - what good looks like

Each spec gives: user goal, entry, steps/screens, every state, exact copy, and
acceptance criteria that qa-engineer can automate. Copy lines use `> [ID] text` so the
readability script can find them.

| File | What it shows |
|---|---|
| `flow-pick-city-outlook.md` | Pick city -> outlook. States ST1-ST8 (loading with/without cache, loaded, partial, error, offline/stale, alerts unknown, empty), all four risk levels, NWS override, AC1-AC12. |
| `ios-install-sheet.md` | iPhone Add to Home Screen sheet: when to show (second visit, not installed, no active alert, 30-day snooze), current Safari steps incl. Open as Web App, dialog behaviour, AC1-AC8. |
| `console-approve-deploy.md` | Agent Console Approve and Deploy: exact-count button, confirmation sheet with checkbox (+ optional password), progress, success, stale, failure, rate limit, session, double submit, AC1-AC10. |
| `readability.mjs` | Zero-dependency Flesch-Kincaid grade check of every copy line; target grade <= 8; lines under 6 words are listed but not graded. |
| `readability-results.txt` | Last run output. |

## How to run
```bash
node readability.mjs            # all specs in this folder
node readability.mjs ios-install-sheet.md
```

## Results (2026-11-26)
- 62 copy lines found; 43 long enough to grade; **0 failing**; overall grade **3.1**.
- Two lines were rewritten after the first run:
  - `CONF-PASS` "Enter your console password to confirm." (8.4) -> "Type your console password to go on." (4.0)
  - `NWS-SUB` "Official alert from the National Weather Service." (10.7) -> "This alert is from the National Weather Service." (6.7)
- One accepted exception: `NOTICE` (grade 9.9) - the not-an-official-warning text is
  fixed wording in CLAUDE.md and the risk-communication skill.
- Caveat: syllables are counted with a heuristic; treat grades as +/- 1. Short labels
  (buttons, titles) are judged by HIG writing rules, not FK.

## Not verified
- Safari menu wording on every iOS version (the Apple Support page read was the current
  guide). Check on a real iPhone before release.
- Level wording needs flood-risk-scientist sign-off.
