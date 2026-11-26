Source: https://web.dev/articles/maskable-icon
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/display-mode
Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env
Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport
Retrieved: 2026-11-26

# Maskable icons, display-mode and safe areas

## Maskable icons (web.dev, 2019 article, still current reference)
- Android 8.0+ shows adaptive icons in many shapes; non-maskable (transparent) icons get placed in
  a **white circle**.
- A maskable icon is an **opaque** image with padding. The spec's minimum **safe zone** is a centred
  circle with **radius = 40% of the icon width**; the outer 10% may be cropped on some platforms.
  Keep the logo inside that circle.
- Declare with `"purpose": "maskable"`. Default purpose is `"any"`. You may write `"any maskable"`
  to use one file for both, but then the padded artwork is also used unmasked.
- Check: Chrome DevTools → Application → Manifest/Icons → "Show only the minimum safe area for
  maskable icons"; or maskable.app (preview + editor).
- Our example `../examples/make-icons.mjs` draws the maskable disc at 30% radius (inside 40%).

## `display-mode` media feature (MDN)
Values: `browser`, `fullscreen`, `minimal-ui`, `picture-in-picture`, `standalone`,
`window-controls-overlay` (desktop app with Window Controls Overlay).
- It reports the mode actually in use, which may differ from the manifest request if unsupported.
- Also matches modes set by the Fullscreen API / Document Picture-in-Picture API.
```css
@media (display-mode: standalone) { #install-btn, #ios-sheet { display: none !important; } }
```
```js
const installed = window.matchMedia('(display-mode: standalone)').matches;
```
(MDN's page shows only CSS; `matchMedia` is the standard JS way to evaluate the same query.)

## Safe areas: `viewport-fit=cover` + `env()`
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  - `viewport-fit`: `auto` (default, page fully viewable), `contain` (scaled to largest inscribed
    rectangle), `cover` (fills the display). With `cover`, MDN: "It's highly recommended to use the
    safe area inset variables to ensure that important content doesn't end up outside the display."
- `env(name, fallback)`: fallback is used if the variable is unsupported or missing. Names are
  **case-sensitive**.
  - `safe-area-inset-top|right|bottom|left`
  - `safe-area-max-inset-top|right|bottom|left`
  - `titlebar-area-x|y|width|height` (Window Controls Overlay)
  - `keyboard-inset-top|right|bottom|left|width|height`
```css
body { padding: env(safe-area-inset-top, 0) env(safe-area-inset-right, 0)
                env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0); }
.bottom-banner { bottom: calc(12px + env(safe-area-inset-bottom, 0)); }
```
- `interactive-widget` (viewport meta): `resizes-visual` (default), `resizes-content`,
  `overlays-content` — how the on-screen keyboard affects the viewports. Leave default unless the
  city search field is hidden by the keyboard.

## Accessibility tie-ins (from our docs/05 + skill `accessibility-wcag22`)
- Fixed bottom UI (update banner, install sheet) must stay above the home indicator (safe-area
  bottom) and must not obscure focused elements (WCAG 2.2 SC 2.4.11).
- Primary buttons 44×44 CSS px (example CSS uses `min-height/min-width: 44px`).

## What emulation can and cannot show
Playwright/Chromium emulation does not simulate a notch; `env(safe-area-inset-*)` resolves to 0
there (fallbacks apply). Safe areas need a real iPhone check (doc 05 checklist).
That env() is 0 under emulation is our expectation, not checked against a doc — (unconfirmed).
