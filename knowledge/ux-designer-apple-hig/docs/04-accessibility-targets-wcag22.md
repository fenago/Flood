Source: https://developer.apple.com/design/human-interface-guidelines/accessibility
Source: https://developer.apple.com/design/human-interface-guidelines/buttons
Source: https://www.w3.org/WAI/WCAG22/quickref/
Source: https://www.w3.org/TR/WCAG22/
Retrieved: 2026-11-26

# Accessibility: targets, focus, contrast, reflow

## Target size
| Source | Number |
|---|---|
| HIG Accessibility / Buttons, iOS | Default 44 x 44 pt, minimum 28 x 28 pt |
| HIG padding | ~12 pt around bezelled controls, ~24 pt around borderless ones |
| WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA | 24 x 24 CSS px |
| Flood Watch rule | 44 x 44 CSS px for tabs, primary buttons, sheet buttons, list rows |

2.5.8 exceptions (paraphrased): **Spacing** (undersized target whose 24 px circle,
centred on it, touches no other target or circle); **Equivalent** (another control on
the page does the same and meets it); **Inline** (link inside a sentence); **User
agent** (browser-drawn, not restyled); **Essential** (presentation required, for
example legally). We do not rely on these except Inline for links in sentences.

## Focus
- SC 2.4.7 Focus Visible (AA): keyboard focus indicator is visible.
- SC 2.4.11 Focus Not Obscured (Minimum) (AA): a focused component is not **entirely**
  hidden by author content. Risk on Flood Watch: the fixed glass tab bar, a sticky top
  bar, cookie-like banners and the iOS home indicator area. Fix with
  `scroll-padding-top/bottom` equal to bar heights plus safe areas.

## Contrast
- SC 1.4.3 Contrast (Minimum), AA: text 4.5:1; large-scale text 3:1 (large = at least
  18 pt, or 14 pt bold). No requirement for inactive controls, pure decoration, logos.
- SC 1.4.11 Non-text Contrast, AA: UI component boundaries/states and meaningful
  graphics 3:1 against adjacent colours (example: focus ring, selected tab indicator,
  risk icon if it carries meaning).
- HIG: text up to 17 pt 4.5:1; 18 pt+ or bold 3:1; Dark Mode page asks for 7:1 where
  possible for small custom-coloured text.
- SC 1.4.1 Use of Color (A): colour is never the only cue.

## Reflow and resize
- SC 1.4.10 Reflow, AA: no two-direction scrolling at **320 CSS px** wide (vertical
  content) or **256 CSS px** tall (horizontal content). Exceptions: content that needs a
  2D layout (maps, data tables, the tide chart's table may scroll horizontally).
- SC 1.4.4 Resize Text, AA: text resizes to 200% without loss. HIG also asks for
  at least 200% enlargement.

## Status and errors
- SC 4.1.3 Status Messages, AA: status updates are exposed by role/property without
  moving focus -> `role="status"` / `aria-live="polite"` for "Updated 10:05 am" and
  level changes; `role="alert"` for errors.
- SC 3.3.1 Error Identification, A: input errors are named and described in text
  (console password field).

## Motion
- HIG Reduce Motion: replace slides with fades, no blur animations, tighter springs.
- SC 2.3.3 Animation from Interactions is AAA; we meet it anyway with
  `prefers-reduced-motion`.

## VoiceOver notes for Flood Watch (our practice)
- Risk badge reads as one phrase: "Flood risk today: High". Icon is `aria-hidden`.
- Headings in order: screen title (h1) -> card titles (h2).
- The not-an-official-warning notice is real text, not an image.

## Acceptance-test language for QA
Write criteria as checks: "Each tab's bounding box is at least 44 x 44 CSS px at 390 px
viewport", "At 320 px width `scrollWidth <= clientWidth`", "Tabbing to the last link
in main leaves it at least partly visible above the tab bar".
