Source: https://developer.apple.com/design/human-interface-guidelines/alerts
Source: https://developer.apple.com/design/human-interface-guidelines/feedback
Source: https://developer.apple.com/design/human-interface-guidelines/loading
Source: https://developer.apple.com/design/human-interface-guidelines/buttons
Retrieved: 2026-11-26

# Alerts, feedback, loading and buttons

Note: "alert" below means an Apple UI alert dialog. An NWS weather alert is content
and is shown as a banner on the outlook, not as a dialog.

## Alerts (dialogs)
- Use sparingly; they interrupt. Only essential information and useful actions.
- Do not use an alert just to inform; put the information in context instead.
- Title: complete sentence -> sentence case with end punctuation; fragment -> title
  case, no end punctuation. Keep to two lines or fewer.
- Message: as short as possible, complete sentences.
- Up to **three** buttons. Button titles: 1-2 words, verbs, title case, no punctuation.
- Use "Cancel" for the cancel button; avoid "Yes"/"No"; use "OK" only for purely
  informational alerts.
- Cancel goes on the leading side of a row (or bottom of a stack); the default button on
  the trailing side (or top). Never make Cancel the default.
- Destructive style marks an action that destroys something people did not
  deliberately choose.

## Buttons
- Hit region at least **44 x 44 pt** on iOS.
- One, at most two, prominent (filled, accent) buttons per view, for the most likely
  action. Distinguish the preferred choice by style, not size.
- Destructive buttons use red and are never given the primary role, even if likely.
- Labels: a few words, title case, start with a verb ("Add to Cart" style).
- For actions that do not finish at once, show an activity indicator in the button and
  optionally change the label ("Checkout" -> "Checking out...").
- On colourful Liquid Glass content, keep labels monochrome.

## Feedback
- Put status near what it describes, passively, without forcing an action.
- Confirm significant completed actions; people mostly need to hear about failures.
- When something cannot be done, say why.
- Warn before unexpected, irreversible loss; do not warn when loss is the expected
  result.
- Overused alerts lose impact.
- Use several channels (colour, text, sound, haptics) so feedback reaches people who
  silence the phone, look away or use VoiceOver. Web: colour + text + icon +
  `aria-live` / `role="alert"`.

## Loading
- Show something immediately; an empty screen reads as broken. Use placeholders that
  are replaced as data arrives.
- Determinate progress when duration is known; indeterminate when not.
- Let people do other things while loading.
- If loading takes a second or two, a loading indicator beats a blank screen.

## Flood Watch application
| Situation | Pattern |
|---|---|
| Fetching forecast | Skeleton card in the real layout + "Getting the latest forecast..." (indeterminate). Cached data, if any, shows at once with its age. |
| Refresh finished | Update "Updated 10:05 am" in place; no toast. Announce via `aria-live="polite"` only if the level changed. |
| Network error with cache | Banner near the top: what happened + data age + next step. No dialog. |
| Network error, no cache | Error state in the card with a Try Again button (44 px). |
| Approve and deploy (console) | Confirmation sheet (not an alert) because it needs a file list; button shows spinner + "Deploying...". |
| Reject proposal | No confirmation needed beyond the optional note; it is reversible (agent can re-propose). |
