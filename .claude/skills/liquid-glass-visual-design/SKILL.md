---
name: liquid-glass-visual-design
description: Apply an Apple Liquid Glass-inspired visual language to Flood Watch on the web - translucent layered surfaces, depth, colour, type and motion, with solid fallbacks. Use when designing or reviewing how any screen looks.
user-invocable: false
---
# Liquid Glass visual design (web)

Principles (Apple HIG Materials; `knowledge/ui-designer-apple-liquid-glass/docs/01`, `05`): content first; glass only on the **navigation/control layer** - top bar, tab bar, sheets - never on the content layer. Risk card, beach card and alert banner are **solid surfaces**; never glass under body text or risk numbers. At most two glass surfaces per screen (top bar + tab bar) or one sheet; no glass on glass.

Build:
- Glass surface: `background: color-mix(in srgb, var(--surface) 86%, transparent)` (light 86%, dark 88%); `-webkit-backdrop-filter` and `backdrop-filter: blur(20px) saturate(160%); border: 1px solid var(--glass-edge); border-radius: 22px;` plus a subtle inner highlight.
- Default glass must be readable on its own (~86-88% opaque): iPhone Safari ignores `prefers-reduced-transparency`, so that fallback never fires there.
- Fallbacks (still add them): `@supports not (backdrop-filter: blur(1px))`, `@media (prefers-reduced-transparency: reduce)` and `(prefers-contrast: more)` → solid `var(--surface)`.
- Under glass, ensure text contrast ≥ 4.5:1 against the *worst* background it can sit on; add a scrim if needed. Check with `knowledge/ui-designer-apple-liquid-glass/examples/contrast-check.mjs`.
- Type: system stack `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`; large clear numerals for risk and score.
- Motion: gentle springs ≤ 300 ms; none under `prefers-reduced-motion`.
- Risk colours (Low/Elevated/High/Severe) must stay distinguishable in light, dark and for colour-blind users, always paired with a word and icon.

Original artwork only — do not copy Apple icons, SF Symbols, logos or screenshots.
