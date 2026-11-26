Source: https://developer.apple.com/design/human-interface-guidelines/typography
Source: https://developer.apple.com/design/human-interface-guidelines/layout
Source: https://developer.apple.com/design/human-interface-guidelines/app-icons
Retrieved: 2026-11-26

# Typography, layout and icons

## Type sizes (iOS)
- Default body **17 pt**, minimum **11 pt** (HIG Typography and Accessibility).
- iOS Dynamic Type, "Large" (default) size:

| Style | Size / leading (pt) | Weight | Flood Watch token |
|---|---|---|---|
| Large Title | 34 / 41 | Regular | `--text-3xl` (risk word, score) |
| Title 1 | 28 / 34 | Regular | `--text-2xl` |
| Title 2 | 22 / 28 | Regular | `--text-xl` |
| Title 3 | 20 / 25 | Regular | `--text-lg` (lead sentence) |
| Headline | 17 / 22 | Semibold | `--text-base` + semibold |
| Body | 17 / 22 | Regular | `--text-base` |
| Callout | 16 / 21 | Regular | - |
| Subhead | 15 / 20 | Regular | - |
| Footnote | 13 / 18 | Regular | `--text-sm` (data age, attribution) |
| Caption 1 | 12 / 16 | Regular | `--text-xs` (tab labels only) |
| Caption 2 | 11 / 13 | Regular | not used |

On the web 1 pt in these tables maps to 1 CSS px at default zoom (iOS points and CSS px
are both device-independent; unconfirmed on Apple's page). Tokens are in rem so they
follow the browser text size.

## Weights and legibility
- Prefer Regular, Medium, Semibold, Bold. Avoid Ultralight, Thin, Light, especially
  small. If a thin font is unavoidable, go larger than recommended.
- System fonts are San Francisco (SF Pro etc.) and New York. We use the platform
  stack `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` and
  never ship SF font files.
- Use tabular numerals (`font-variant-numeric: tabular-nums`) for scores and times
  (our choice, not from HIG).

## Dynamic Type / text size
- Layout must work at every text size; keep truncation minimal; at large sizes stack
  items instead of side-by-side; keep the same hierarchy.
- Let people enlarge text at least **200%** (HIG Accessibility; also WCAG 1.4.4).
- Grow meaningful icons with text size (size icons in `em`).

## Layout
- Respect safe areas so the Dynamic Island, status bar and home indicator do not cover
  content or controls. Web: `viewport-fit=cover` + `env(safe-area-inset-*)`.
- Use standard margins; limit text line length for readability (our max: 40rem column).
- Group related items with space, container shapes or separators.
- Use progressive disclosure: show the answer first, details in a sheet.
- Full-screen backgrounds should extend under tab bars and toolbars.
- Align items; alignment signals relationship.
- iOS platform section of the Layout page: no extra considerations listed.
- Concentric corners come from the Adopting Liquid Glass overview, not the Layout page.

## App icon (for the PWA icon and apple-touch-icon)
- iOS/iPadOS/macOS icon canvas **1024 x 1024 px**; the system applies the corner mask,
  so supply a **square** image with no pre-rounded corners.
- iOS icons have a background layer plus foreground layers; people can choose default,
  dark, clear or tinted looks (iOS 26 era). A web apple-touch-icon is a single flat
  PNG (180 x 180 per docs/02), so design a simple shape that survives tinting.
- Keep it simple: few shapes, solid or gradient background. Avoid text unless
  essential. Never use replicas of Apple hardware.
- Flood Watch icon idea: an original water-level mark or drop on a deep-navy
  background (`#0b1d2a`, the manifest theme colour). Original artwork only.
