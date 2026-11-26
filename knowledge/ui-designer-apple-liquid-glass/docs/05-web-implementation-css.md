Source: https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/env
Retrieved: 2026-11-26

# Building glass on the web (CSS)

## Support summary (MDN, read 2026-11-26)
| Feature | Status | Notes |
|---|---|---|
| `backdrop-filter` | Baseline 2024 (newly available since Sept 2024) | Element or its background must be (partly) transparent to see it. |
| `color-mix()` | Baseline widely available (since May 2023) | Default interpolation space `oklab`; we use `in srgb` so the checker's maths matches. |
| `prefers-color-scheme` | Widely available (since Jan 2020) | Values `light`, `dark`. |
| `prefers-reduced-motion` | Widely available (since Jan 2020) | iOS: Settings > Accessibility > Motion. |
| `env(safe-area-inset-*)` | Widely available (since Jan 2020) | Takes a fallback: `env(safe-area-inset-bottom, 0px)`. |
| `prefers-reduced-transparency` | **Experimental, limited** | Chrome 118+ only. **Safari (macOS and iOS): no support.** Firefox: behind a flag. |

Consequences:
- On iPhone Safari our reduced-transparency fallback never fires. The default glass
  must therefore pass contrast on its own (it does: 86% / 88% tint).
- Keep `-webkit-backdrop-filter` next to `backdrop-filter`. MDN's current table shows
  full support without mentioning the prefix; older Safari versions needed it
  (unconfirmed which versions on the page read). It costs nothing.

## backdrop-filter
```css
.glass {
  background: color-mix(in srgb, var(--color-surface) 86%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  backdrop-filter: blur(20px) saturate(160%);
}
```
Values: `none` or a list of filter functions (`blur()`, `brightness()`, `contrast()`,
`saturate()`, `opacity()` ...) or an SVG `url()` filter.

## color-mix()
`color-mix(in srgb, var(--color-surface) 86%, transparent)` = surface colour at 86%
alpha. Percentage rules: omitted ones fill to 100%; if both sum below 100% the result
gets an alpha multiplier. Percentages may come from a custom property
(`var(--glass-opacity)`), which keeps one tunable token.

## Fallbacks (order matters: later rules win)
```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :root { --glass-bg: var(--color-surface); }
}
@media (prefers-reduced-transparency: reduce) { :root { --glass-bg: var(--color-surface); --glass-blur: 0px; } }
@media (prefers-contrast: more) { :root { --glass-bg: var(--color-surface); --glass-edge: var(--color-text); } }
@media (prefers-reduced-motion: reduce) { :root { --motion-fast: 0ms; --motion-base: 0ms; } }
```
OS switches for reduced transparency (MDN): iOS Settings > Accessibility > Display &
Text Size > Reduce Transparency; macOS System Settings > Accessibility > Display >
Reduce transparency; Windows Settings > Personalization > Colors > Transparency effects.

## Safe areas
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
```css
.tabbar { bottom: calc(8px + env(safe-area-inset-bottom, 0px)); }
```
MDN's env() page does not mention `viewport-fit=cover`; that requirement comes from
docs/02-pwa-installability.md and WebKit practice (unconfirmed on the MDN page).
Insets are 0 on rectangular screens.

## Dark mode
```css
:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { /* dark tokens */ } }
```
Also add `<meta name="color-scheme" content="light dark">` so form controls and
scrollbars match before CSS loads.

## Performance notes (our guidance, unconfirmed by MDN)
- Each `backdrop-filter` layer costs GPU work; keep to 2 glass layers per screen.
- Do not animate `backdrop-filter` values; animate opacity/transform only, and not at
  all under reduced motion.

## Testing
- `../examples/render-check.mjs` emulates `prefers-reduced-transparency: reduce`
  through the Chrome DevTools Protocol (`Emulation.setEmulatedMedia`) and asserts the
  tab bar turns solid. WebKit must be checked on a real iPhone.
