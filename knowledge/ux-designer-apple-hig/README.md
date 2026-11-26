# Knowledge: ux-designer-apple-hig (Wren)

Reference notes and worked specs for Flood Watch's flows, copy and accessibility,
following Apple's Human Interface Guidelines, WCAG 2.2 and NWS risk messaging.
Notes are paraphrased; each doc lists sources and retrieval date.

Last verified: 2026-11-26

## docs/
| File | One line |
|---|---|
| `docs/01-ios-navigation-tab-bars-sheets.md` | iPhone usage context, tab bar rules (navigation only, labels, badges, never hide tabs), sheet detents, grabber, Cancel/Done placement. |
| `docs/02-alerts-feedback-loading.md` | Alert dialog rules (max 3 buttons, verb titles, Cancel placement), 44 pt buttons, feedback near the problem, show-something-now loading. |
| `docs/03-writing-onboarding-permissions-notifications.md` | Voice, term list, error and empty-state copy, short onboarding, ask permission in context, notification text rules. |
| `docs/04-accessibility-targets-wcag22.md` | 44 pt vs 24 px targets and 2.5.8 exceptions, 2.4.11 focus not obscured, 1.4.3/1.4.11 contrast, 1.4.10 reflow at 320 px, status messages. |
| `docs/05-risk-communication-nws.md` | Turn Around Don't Drown facts (6 in, 12 in, 2 ft), message order, level wording draft, tone and override rules. |
| `docs/06-ios-home-screen-install.md` | Apple's current Safari Add to Home Screen steps (Share, Add to Home Screen, Open as Web App, Add) and what they mean for our sheet. |

## examples/
| File | One line |
|---|---|
| `examples/README.md` | Index, how to run, recorded readability results. |
| `examples/flow-pick-city-outlook.md` | Full flow spec: all states, all risk levels, copy, 12 acceptance criteria. |
| `examples/ios-install-sheet.md` | iOS install sheet spec, trigger rules, copy, 8 acceptance criteria. |
| `examples/console-approve-deploy.md` | Approve and Deploy confirmation spec, states, copy, 10 acceptance criteria. |
| `examples/readability.mjs` | Flesch-Kincaid grade checker for copy lines. |
| `examples/readability-results.txt` | Last run: 43 graded lines, 0 failing, overall grade 3.1. |

## Key takeaways
1. Official alerts first, our level second, details last; the notice is always visible.
2. 44 x 44 px targets everywhere that matters; never let the tab bar hide focus.
3. iOS install = instructions, not a button; show once, after the second visit, never during an alert.
