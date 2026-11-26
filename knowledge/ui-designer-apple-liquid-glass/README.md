# Knowledge: ui-designer-apple-liquid-glass (Sable)

Reference notes and worked examples for Flood Watch's visual design in an Apple
Liquid Glass-inspired style, built for the web. Notes are paraphrased from official
pages; each doc lists its sources and retrieval date.

Last verified: 2026-11-26

## docs/
| File | One line |
|---|---|
| `docs/01-liquid-glass-materials.md` | What Liquid Glass is, regular vs clear, 35% dimming layer, glass only in the navigation layer, accessibility behaviour. |
| `docs/02-color-and-dark-mode.md` | Glass tinting, colour-not-alone, light/dark/increased-contrast variants, contrast numbers (4.5, 3, 7), WCAG luminance formula, text-on-glass worst case. |
| `docs/03-typography-layout-icons.md` | iOS type scale (17 pt body, 11 pt min, Dynamic Type table), weights, safe areas, layout, 1024 px square app icon rules. |
| `docs/04-motion-and-accessibility.md` | Purposeful brief motion, Reduce Motion substitutions, 44 pt targets and 12/24 pt padding, visual review checklist. |
| `docs/05-web-implementation-css.md` | MDN support for backdrop-filter, color-mix, env(), prefers-* queries (Safari lacks reduced-transparency), fallback CSS. |

## examples/
| File | One line |
|---|---|
| `examples/README.md` | Index of the examples, how to run them, and recorded results. |
| `examples/tokens.css` | Token set with risk colours + `-on` pairs, glass tokens and all fallbacks. |
| `examples/contrast-check.mjs` | Zero-dependency WCAG contrast checker for every token pair, including text on glass. |
| `examples/contrast-results.txt` | Last checker output: 42 pairs, 0 failing. |
| `examples/risk-card-demo.html` | Outlook screen demo: solid risk card, glass top bar and tab bar. |
| `examples/render-check.mjs` | Playwright + axe render checks and screenshots. |
| `examples/render-results.txt` | Last render output: 8 checks, 0 failing. |
| `examples/risk-card-demo-*.png` | Light, dark and reduced-transparency screenshots. |

## Key takeaways
1. Glass is for controls and navigation, never for the risk word, score or body text.
2. Safari does not support `prefers-reduced-transparency`, so default glass must pass
   contrast alone: on the web that means an 86-88% opaque tint.
3. Risk = word + distinct icon shape + colour, with a lightness order that survives greyscale.
