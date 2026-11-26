---
name: vanilla-frontend
description: Build the Flood Watch front end with plain HTML, CSS and ES-module JavaScript - structure, conventions and performance budget. Use when writing or editing files in public/ or src/.
user-invocable: false
---
# Plain front end

- Semantic HTML first (`header`, `main`, `nav`, `button`, `label`), then CSS, then JS as enhancement.
- ES modules in `src/` (`api/`, `scoring/`, `ui/`, `console/`); no framework unless `software-architect` approves one.
- Scoring code is pure functions (data in, result out) so it is unit-testable and shared by UI and tests.
- Render user or agent text with `textContent` or a sanitising Markdown renderer — never `innerHTML` with untrusted strings.
- No inline `<script>` or inline event handlers (CSP has no `unsafe-inline`).
- Budget: < 100 KB JS gzipped for the public app; first meaningful paint < 2 s on mid-range phone over 4G.
- Mobile-first layout, works at 320 px wide, safe areas via `env(safe-area-inset-*)`.
