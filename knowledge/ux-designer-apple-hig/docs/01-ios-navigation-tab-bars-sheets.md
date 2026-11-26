Source: https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
Source: https://developer.apple.com/design/human-interface-guidelines/tab-bars
Source: https://developer.apple.com/design/human-interface-guidelines/sheets
Retrieved: 2026-11-26

# iOS context, tab bars and sheets

Paraphrased notes; Apple's text is copyrighted.

## Designing for iOS - what it means for Flood Watch
- Viewing distance is usually a foot or two; people hold the phone in one or both hands.
- Sessions are often a minute or two of checking something. Flood Watch's main job is
  exactly that: answer "is my street going to flood?" in about five seconds.
- Limit on-screen controls; keep secondary details one tap away.
- Adapt to orientation, Dark Mode and Dynamic Type.
- Controls in the middle and bottom of the screen are easier to reach; support swipe
  back. -> Primary actions and the tab bar live at the bottom.
- With permission, use device data (for example location) instead of asking people to
  type it. -> "Use my location" next to the city list, only when tapped.

## Tab bars
| HIG guidance (paraphrased) | Flood Watch rule |
|---|---|
| Tab bars are for navigation, not actions. | Tabs: Outlook, Beach, Cities, Settings. "Refresh" is not a tab. |
| Use as few tabs as needed; avoid overflow. (iPadOS custom tab lists: default 5 or fewer.) | 4 tabs. The Agent Console is never in the public tab bar. |
| Label every tab, ideally one word. | One-word labels above. |
| Badges only for critical new info; red oval with number or "!". | Badge the Outlook tab only when an NWS alert is active for the saved city. |
| Keep the tab bar visible across sections, except under a modal. | Tab bar stays on all four screens; hidden only behind full-height sheets. |
| Do not disable or hide tabs when content is unavailable; explain inside instead. | Beach tab with no data shows an empty/error state, not a greyed tab. |
| iOS 26: the tab bar floats on Liquid Glass; it may minimise on scroll down. | Optional on the web. If used, scrolling up or reaching the top restores it. |
| A search tab may sit at the trailing end. | Not needed in v1 (12 cities). Revisit if "search any city" ships. |
| Each tab keeps its own navigation state. | Switching tabs keeps scroll position and open detail. |

## Sheets
- Use a sheet for a scoped task tied to the current context (pick a city, read alert
  details, install steps, approve a proposal). Complex or long flows need another pattern.
- Detents: **large** = full height, **medium** = about half. Supporting medium allows
  progressive disclosure on iPhone. Large is always supported; medium-only stops
  expanding.
- Add a **grabber** on resizable sheets; it works with VoiceOver too.
- Buttons: single-view sheet -> Cancel at leading edge, Done at trailing edge.
  Multi-step: Back replaces Cancel after step one; Done becomes active at the end.
  Always offer a way out (Cancel or Back); never show Cancel, Done and Back together.
- Allow swipe-to-dismiss. If there are unsaved changes, confirm with an action sheet.
- One sheet at a time. If a sheet leads to another, close the first.

## Web mapping
- Sheet = `<dialog>` opened with `showModal()`, focus moved inside, Esc closes, focus
  returns to the trigger. (Web practice; not from HIG.)
- Medium detent ~ 50vh with an expand control; large ~ full height minus top safe area.
- Grabber is decorative; the real controls are the Cancel/Done buttons (keyboard and
  screen readers cannot drag).
