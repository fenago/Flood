Source: https://developer.apple.com/design/human-interface-guidelines/color
Source: https://developer.apple.com/design/human-interface-guidelines/dark-mode
Source: https://developer.apple.com/design/human-interface-guidelines/accessibility
Source: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
Source: https://www.w3.org/WAI/WCAG22/quickref/
Retrieved: 2026-11-26

# Colour, contrast and Dark Mode

## Liquid Glass colour (HIG Color, change log latest 16 Dec 2025)
- Glass has no colour of its own; it picks up colour from what is behind it.
- Tint glass sparingly, like stained glass, to emphasise one thing (a primary action
  or a status). To emphasise a primary action, colour the **background**, not the label,
  and do not tint the background of several controls.
- Over colourful content, prefer monochrome labels in tab bars/toolbars, or an accent
  colour that is clearly different from the content.
- Make sure the resting state (for example top of a scroll view) is legible.

## Inclusive colour
- Never rely on colour alone to show state, interactivity or key information; add
  text labels or distinct shapes (HIG Color and HIG Accessibility; WCAG 1.4.1 Level A).
- Flood Watch: each risk level = word + distinct icon shape + colour.
  Shapes in our example: Low circle-check, Elevated triangle, High diamond, Severe octagon.
- Keep a lightness order (Low/High mid, Elevated light, Severe darkest) so levels
  differ in lightness, not only hue - helps colour-blind users and greyscale.

## Light, dark and increased contrast
- Supply light and dark variants for every custom colour, plus an increased-contrast
  option for each (HIG Color). Provide both even if one appearance ships, because
  glass adapts.
- Respect the system appearance; avoid an app-only appearance switch (HIG Dark Mode).
  Web: `prefers-color-scheme` + `color-scheme: light dark`.
- iOS uses **base** (dimmer) and **elevated** (brighter) dark backgrounds so a sheet
  or popover over another dark screen appears to come forward. Web mapping:
  `--color-bg` (base) < `--color-surface` < `--color-surface-2` in lightness.
- Slightly darken images with white backgrounds in Dark Mode so they do not glow.
- Test Dark Mode with Increase Contrast and Reduce Transparency on, separately and
  together.

## Contrast numbers
| Source | Rule |
|---|---|
| HIG Dark Mode | At least **4.5:1**; aim for **7:1** for custom colours, especially small text. |
| HIG Accessibility | Text up to 17 pt: 4.5:1. 18 pt and up: 3:1. Bold text any size: 3:1. |
| WCAG 2.2 SC 1.4.3 (AA) | Text 4.5:1; large-scale text 3:1. Large = at least 18 pt, or 14 pt bold. |
| WCAG 2.2 SC 1.4.11 (AA) | UI component boundaries/states and needed graphics: 3:1 against adjacent colours. |

18 pt = 24 CSS px and 14 pt = about 18.67 CSS px (1 pt = 4/3 px; unconfirmed on the
pages read, this is the standard CSS unit relation). Flood Watch policy: treat all
badge and label text as normal text (4.5:1), even when large.

Note the HIG "bold text any size 3:1" row is looser than WCAG (WCAG needs 14 pt bold).
Follow WCAG, the stricter one, for the web.

## WCAG relative luminance (WCAG 2.2 definition)
```
c = channel/255
c' = c <= 0.04045 ? c/12.92 : ((c + 0.055)/1.055) ^ 2.4
L  = 0.2126 R' + 0.7152 G' + 0.0722 B'
ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```
WCAG 2.2 uses 0.04045 (older texts said 0.03928; the difference does not change
results for 8-bit colours). Implemented in `../examples/contrast-check.mjs`.

## Text on glass: check the worst background
A translucent surface's real colour depends on what is behind it. For a uniform
backdrop, blur and saturate change nothing, so a solid colour is the worst case.
Composite `tint * a + backdrop * (1 - a)` over black, white, grey and pure hues and
check every label against the result. Finding from our tokens:
- Light glass at 72% failed (accent label 3.36:1 over black). 86% passes (4.82:1).
- Dark glass at 80% failed (accent label 3.88:1 over white). 88% passes (5.07:1).
So honest web glass behind small text is mostly opaque. Apple avoids this with
adaptive luminance; CSS cannot.

## System colours (names only)
HIG lists Red, Orange, Yellow, Green, Mint, Teal, Cyan, Blue, Indigo, Purple, Pink,
Brown and six system greys. Apple's exact values are not copied here; our risk colours
are our own and checked with our script.
