---
name: beach-day-score
description: Compute and tune the Flood Watch beach-day score (0-100) with hard safety vetoes and weighted comfort factors. Use when changing beach scoring, thresholds, labels or tips.
user-invocable: false
---
# Beach-day score

Window 10:00–16:00 local. Config in `public/config/scoring.json`.

Vetoes (cap score at 10, show reason): NWS high rip current risk / Rip Current Statement; `weather_code` 95, 96, 99 (thunderstorm); active tropical/flood/coastal warning; `wind_gusts_10m` ≥ 30 mph; `wave_height` ≥ 2 m.

Weights (sum 100): rain chance 25 (≤20% best, ≥60% → 0); feels-like 15 (78–90 °F best, ≥103 °F → 0, NWS heat-index danger); wind 15 (5–12 mph best, ≥25 → 0); waves 15 (≤0.6 m best, ≥1.5 m → 0); water temp 10 (77–86 °F best, ≤70 → 0); sky 10 (10–50% cloud best); UV 10 (≤7 best, 11+ → 3).

Labels: 80–100 Great, 60–79 Good, 40–59 Meh, <40 Skip it. Show top 2 reasons and an EPA UV tip (8–10: avoid sun 11 a.m.–4 p.m.; 11+: skin burns in minutes, sand reflects UV).

Sourced vs heuristic: rip-current categories (NWS), heat index (NWS/NOAA), UV categories (EPA) are sourced; all other cut-offs are heuristics — say so in code comments.
