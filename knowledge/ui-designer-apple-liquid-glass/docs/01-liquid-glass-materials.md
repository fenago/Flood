Source: https://developer.apple.com/design/human-interface-guidelines/materials
Source: https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
Source: https://developer.apple.com/videos/play/wwdc2025/219/ ("Meet Liquid Glass", WWDC25)
Retrieved: 2026-11-26

# Liquid Glass and materials

Notes in our own words. Apple's text is copyrighted: paraphrase, quote only short phrases.
HIG Materials change log: Liquid Glass guidance added 9 June 2025, updated 9 September 2025.

## What Liquid Glass is
- A dynamic material that forms a separate **functional layer** for controls and
  navigation (tab bars, toolbars, sidebars) floating above the content layer.
- Content scrolls underneath and "peeks through", which keeps a sense of place.
- Apple's version bends and concentrates light (lensing/refraction), not only blur.
  The web cannot reproduce lensing with CSS alone; we approximate with
  `backdrop-filter: blur() saturate()`, a translucent tint, a light edge and a soft shadow.
- Small elements (tab bars, toolbars) flip between light and dark looks depending on
  what is under them; large elements (sidebars, menus) adapt but do not flip.
  (WWDC25 session.) The web has no automatic flip: we must pick a tint that is
  legible over the worst case instead (see 02-color-and-dark-mode.md).

## Rules that apply to Flood Watch
| HIG guidance (paraphrased) | Flood Watch rule |
|---|---|
| Do not use Liquid Glass in the content layer; use standard materials there. | Risk card, beach card, alert banner = solid surfaces. Glass only on top bar, tab bar, sheets. |
| Use it sparingly; limit to the most important functional elements. | At most two glass surfaces on a screen (top bar + tab bar), or one sheet. |
| Avoid glass on glass (WWDC25). | Buttons inside the glass tab bar use fills/tints, not another glass layer. |
| Two variants: **regular** (blurs, adjusts luminosity, works anywhere) and **clear** (very translucent, for media-rich backgrounds). | We only build "regular". Never "clear" over a risk number or text. |
| Clear glass over bright content: add a dark dimming layer of about **35% opacity**. | If we ever show glass over a photo/map, add a 35% scrim and re-check contrast. |
| Use regular for components with a lot of text (alerts, sidebars, popovers). | Sheets with text use regular-style glass at our checked opacity. |
| Scroll edge effects blur/fade content under bars for legibility. | Top bar can add a short gradient fade under it; never rely on it for contrast. |
| Thicker (more opaque) materials give better contrast for fine text. | Our glass tint is 86% (light) / 88% (dark) opaque - checked, see examples. |

## Standard materials (content layer)
- iOS keeps four standard materials: ultraThin, thin, regular (default), thick.
- Use "vibrant" label colours on materials; avoid the lowest-contrast (quaternary)
  label level on thin/ultraThin because contrast is too low.
- Pick materials by meaning, not by the colour they seem to give, because system
  settings change their look.

## Accessibility settings (Apple behaviour)
- Reduce Transparency: glass becomes frostier and hides more of the content behind.
- Increase Contrast: elements become mostly black or white with a contrasting border.
- Reduce Motion: weaker effects, elastic behaviour turned off.
(WWDC25 "Meet Liquid Glass"; Adopting Liquid Glass overview.)
Our web mapping: `prefers-reduced-transparency` -> solid surface; `prefers-contrast: more`
-> solid surface + text-coloured edge; `prefers-reduced-motion` -> no springs.
Safari does not report `prefers-reduced-transparency` (MDN, see 05), so the
default glass must already be legible on iPhone.

## Other Liquid Glass behaviours worth copying
- Tab bars can minimise when scrolling down and come back on scroll up (Adopting
  Liquid Glass). On the web this is optional; if done, keep the tab bar reachable and
  never hide it while a focused element sits behind it.
- Controls use rounded shapes **concentric** with their container (Adopting Liquid
  Glass). Token rule: inner radius = outer radius - padding (22px card, 16px inner, etc.).
- Shadows get stronger over text and lighter over plain light backgrounds (WWDC25).
  We use one soft shadow token per mode (unconfirmed whether worth adapting on web).

## Do not
- Do not copy Apple icons, SF Symbols, Apple UI screenshots or logos into the repo.
- Do not put body text, the risk word or the score on glass.
- Do not mix clear and regular variants on one screen (WWDC25).
