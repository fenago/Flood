# Sable examples - what good looks like

All files are original work. No Apple icons, SF Symbols, logos or screenshots of Apple UI.

| File | What it shows |
|---|---|
| `tokens.css` | Full token set: light/dark colours, four risk colours each with a paired `-on` text colour, glass tokens, space/radius/type/motion/safe-area tokens, and fallbacks for no `backdrop-filter`, `prefers-reduced-transparency`, `prefers-contrast: more`, `prefers-reduced-motion`. |
| `contrast-check.mjs` | Zero-dependency Node script. WCAG 2.2 relative-luminance maths. Reads `tokens.css`, checks 18 text/UI pairs per mode plus text-on-glass over 7 worst-case backdrops. Exits 1 on any failure. |
| `contrast-results.txt` | Output of the last run (42 pairs, 0 failing). |
| `risk-card-demo.html` | Outlook screen: NWS alert first, solid risk card (word + icon + colour), beach score, legend of all 4 levels, not-an-official-warning notice, Open-Meteo credit, glass top bar and glass tab bar. Loads only `tokens.css`. |
| `render-check.mjs` | Playwright (Chromium) render: screenshots in light, dark and reduced transparency; axe-core WCAG A/AA rules (optional local axe path); 44 px targets; focus not obscured by tab bar; reflow at 320 px; reduced transparency turns glass solid. |
| `render-results.txt` | Output of the last run (8 checks, 0 failing). |
| `risk-card-demo-light.png`, `risk-card-demo-dark.png`, `risk-card-demo-reduced-transparency.png` | Screenshots from the render (390 px wide). |

## How to run
```bash
node contrast-check.mjs                 # uses ./tokens.css
# Playwright must be resolvable; never add node_modules or package.json to the repo.
NODE_PATH=/path/to/node_modules node render-check.mjs /path/to/axe-core/axe.min.js
```

## Results (2026-11-26)
- Contrast: 42/42 pairs pass AA. Lowest: light selected-tab label on glass over black
  4.82:1; Low badge (white on `#17804a`) 4.97:1.
- Iteration that mattered: glass tint at 72% (light) and 80% (dark) **failed** for
  muted and accent labels over black/white backdrops; raised to 86% and 88%.
- Dark-mode Severe was first a light pink that looked close to dark-mode High; changed
  to `#b8283f` with white text (6.15:1) so Severe is the darkest level in both modes.
- Render: axe 0 violations in light and dark (axe marks `color-contrast` "needs review"
  because of the gradient backdrop; the token script covers contrast). Targets >= 44 px,
  focus not obscured, no horizontal scroll at 320 px, reduced transparency -> solid
  `rgb(255,255,255)` tab bar.

## Not covered
- WebKit/iPhone rendering (Playwright run used Chromium only).
- Increased-contrast mode visuals were not screenshotted.
- Real photo/map backdrops: we tested uniform worst-case colours, which bound the result.
