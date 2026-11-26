# Spec: iPhone "Add to Home Screen" sheet

Owner: Wren. Platform rules: ios-android-pwa-behavior skill, docs/02-pwa-installability.md,
knowledge doc 06-ios-home-screen-install.md (Apple Support steps, read 2026-11-26).

## User goal
"Keep Flood Watch one tap away, like an app, so I can check fast during a storm."

## When to show (all must be true)
1. iOS/iPadOS browser (`/iPad|iPhone|iPod/` or iPadOS desktop UA with touch).
2. Not installed: `navigator.standalone !== true` and not `(display-mode: standalone)`.
3. This is at least the **second** visit on a different day.
4. Never dismissed before, or last dismissal was 30+ days ago.
5. No NWS alert is active for the saved city (do not distract during an event; the
   outlook matters more). The Settings row stays available.
Android Chrome uses its own `beforeinstallprompt` button instead; this sheet is iOS only.

## Presentation
- Bottom sheet, medium detent, grabber, title, three numbered steps, one secondary
  "Not Now" button. No "Install" button: on iOS we cannot install for the person.
- Trailing-edge Close (X) with accessible name "Close". Esc and swipe-down close.
- Focus moves to the sheet title on open; returns to the page on close.
- Illustrations: original drawings only (no Apple Share glyph, no Safari screenshots).
  Words carry the meaning; drawings are `aria-hidden`.

## Copy
> [INST-TITLE] Add Flood Watch to your Home Screen
> [INST-WHY] Open it in one tap, even during a storm. It works like an app.
> [INST-STEP1] Tap the Share button in Safari. If you don't see it, tap the menu button first, then Share.
> [INST-STEP2] Scroll down and tap Add to Home Screen.
> [INST-STEP3] Turn on Open as Web App, then tap Add.
> [INST-MISSING] Don't see Add to Home Screen? Tap Edit Actions at the bottom of the list and add it.
> [INST-NOTNOW] Not Now
> [INST-SETTINGS] You can find these steps later in Settings.
> [INST-SETTINGS-ROW] Add to Home Screen

## States
| State | Behaviour |
|---|---|
| Shown | As above. Logged locally only (no analytics server). |
| Not Now / Close / swipe | Save `installHintDismissedAt`; show [INST-SETTINGS] as a 4 s status line (`role="status"`). |
| Opened from Settings | Same sheet, no dismissal timestamp written. |
| Already installed | Sheet never shows; Settings row reads "Installed on this device" (not a button). |
| Storage cleared | Treated as first visit; sheet waits for second visit again. |

## Acceptance criteria
1. AC1 With an iPhone UA and `navigator.standalone=false`, sheet does not show on the
   first visit and shows on a second visit on another day.
2. AC2 With `display-mode: standalone` true, the sheet never shows.
3. AC3 After "Not Now", reloading within 30 days does not show it; after 30 days it can.
4. AC4 With an active NWS alert fixture, the sheet does not auto-show.
5. AC5 Sheet has `role="dialog"`, `aria-modal="true"`, labelled by [INST-TITLE]; focus is
   trapped inside; Esc closes it; focus returns to the previously focused element.
6. AC6 Close and Not Now are each >= 44 x 44 CSS px.
7. AC7 No image in the sheet is an Apple asset; every image is `aria-hidden` and the
   steps are readable as text alone.
8. AC8 All copy lines pass grade <= 8 in `readability.mjs`.

## Handoff
- Sable: original Share-hint drawing, sheet visuals in light/dark.
- pwa-mobile-engineer: detection, timestamps, dialog behaviour.
- qa-engineer: AC1-AC8 with WebKit iPhone emulation plus one manual check on a real
  iPhone (menus vary by iOS version and Safari tab layout).
