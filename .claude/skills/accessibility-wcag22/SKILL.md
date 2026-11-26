---
name: accessibility-wcag22
description: Meet WCAG 2.2 AA in Flood Watch design and code - contrast, colour independence, targets, focus, screen readers, zoom and motion. Use when designing, building or reviewing any UI.
user-invocable: false
---
# Accessibility (WCAG 2.2 AA)

- Contrast ≥ 4.5:1 text, ≥ 3:1 large text and UI parts; check on glass over the worst background.
- Never colour alone: risk = word + icon + colour; diffs = +/− and "added/removed" text.
- Targets ≥ 24×24 CSS px (SC 2.5.8); primary buttons 44×44.
- Keyboard: everything reachable, visible focus, focus not hidden by sticky bars (SC 2.4.11); logical order.
- Screen readers: real headings, labelled controls, `aria-live="polite"` for updated scores; announce completed chat messages, not tokens.
- Zoom 200% and reflow at 320 px without horizontal scroll; text in rem.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-color-scheme`.
- Charts: text summary plus data table.
- Errors: `role="alert"`, say what happened and what to do.
