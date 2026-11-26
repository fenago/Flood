---
name: flood-prognosis-model
description: Compute and tune the Flood Watch flood risk level (Low, Elevated, High, Severe) from rain, antecedent rain, soil moisture, tides, wind and NWS alerts. Use when changing flood scoring logic, thresholds or explanations.
user-invocable: false
---
# Flood prognosis model

Read `docs/01-use-case-and-scoring.md` §3 first. Weights/thresholds live in `public/config/scoring.json`; code only reads them.

Signals per day (and next 6 h): R24 rain sum, Rmax peak hourly rain, R72past (via `past_days=3`), soil near saturation, coastal high tide above MHHW, onshore wind ≥ 20 mph, NWS alerts.

Points: band(R24,[1,2,4,6] in) 0–4 + band(Rmax,[0.5,1,2,3] in/h) 0–4 + band(R72past,[2,4,6]) 0–3 + soil 1 + tide 2 + wind 1.
Levels: ≤2 Low, ≤5 Elevated, ≤8 High, else Severe.
Overrides: Flash Flood/Flood/Coastal Flood **Warning** → at least Severe; Flood Watch or Coastal Flood Advisory → at least High.

Rules:
- Thresholds are heuristics; label them so. Calibrate against dated past South Florida flood events before changing them, and add each event as a fixture test.
- Always return the top reasons in plain words with numbers ("4.2 in of rain expected; ground already wet").
- Missing data lowers confidence; never silently scores as 0 rain. Show "partial data".
- Every change: update fixtures + tests, and get `qa-engineer` and `ux-designer-apple-hig` (wording) review.
