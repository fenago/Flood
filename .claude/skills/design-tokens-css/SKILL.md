---
name: design-tokens-css
description: Define and use Flood Watch design tokens as CSS custom properties for colour, type, spacing, radius, glass and risk levels in light and dark mode. Use when adding styles or changing the theme.
user-invocable: false
---
# Design tokens

- Tokens live in `public/styles/tokens.css` on `:root`; dark values under `@media (prefers-color-scheme: dark)`.
- Groups: `--color-*` (bg, surface, text, text-muted, accent), `--risk-low|elevated|high|severe` (+ `-on` text colour each), `--glass-*` (tint, blur, edge), `--space-1..8` (4 px scale), `--radius-sm|md|lg|pill`, `--font-*`, `--text-xs..3xl` (rem, scales with user font size), `--motion-fast|base`.
- Components use tokens only — no raw hex values outside `tokens.css`.
- Every text/background token pair is listed in `tests/contrast.json` and checked in CI (≥ 4.5:1 normal, ≥ 3:1 large text and UI).
- Changes to risk colours need `ux-designer-apple-hig` sign-off.
