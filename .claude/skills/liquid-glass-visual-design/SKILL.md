---
name: liquid-glass-visual-design
description: Apply an Apple Liquid Glass-inspired visual language to Flood Watch on the web - translucent layered surfaces, depth, colour, type and motion, with solid fallbacks. Use when designing or reviewing how any screen looks.
user-invocable: false
---
# Liquid Glass visual design (web)

Principles: content first; glass is for **controls and navigation layers** (tab bar, toolbars, sheets, cards over imagery), never for body text blocks or risk numbers.

Build:
- Glass surface: `background: color-mix(in srgb, var(--surface) 55%, transparent); backdrop-filter: blur(20px) saturate(160%); border: 1px solid var(--glass-edge); border-radius: 22px;` plus a subtle inner highlight.
- Fallback: `@supports not (backdrop-filter: blur(1px))` and `@media (prefers-reduced-transparency: reduce)` → solid `var(--surface)`.
- Under glass, ensure text contrast ≥ 4.5:1 against the *worst* background it can sit on; add a scrim if needed.
- Type: system stack `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`; large clear numerals for risk and score.
- Motion: gentle springs ≤ 300 ms; none under `prefers-reduced-motion`.
- Risk colours (Low/Elevated/High/Severe) must stay distinguishable in light, dark and for colour-blind users, always paired with a word and icon.

Original artwork only — do not copy Apple icons, SF Symbols, logos or screenshots.
