# Knowledge — flood-risk-scientist

Reference notes and worked examples for the agent that owns `src/scoring/`, `public/config/scoring.json`
and the reason strings. Sourced thresholds (NWS, NOAA, EPA) are separated from heuristics throughout.

Last verified: 2026-11-26

## docs/
- `docs/01-nws-flood-and-coastal-products.md` — Flood/Flash Flood Watch-Warning-Advisory and coastal/tropical product definitions, override mapping, the 2026-11-25 NWS Miami Flood Watch as a calibration case.
- `docs/02-tides-high-tide-flooding.md` — NOAA high tide flooding definition and outlooks, Tech Report 086 thresholds (minor = 0.04·GT + 0.50 m above MHHW), Virginia Key worked numbers (NWS minor 1.30 ft above MHHW), Marine sea-level caveats.
- `docs/03-beach-hazards-rip-heat-uv.md` — NWS rip current risk levels (MFL wording), NWS heat index classes and WPC algorithm, why `apparent_temperature` is not the heat index, EPA UV categories (5-band PDF vs 3-band web page).
- `docs/04-open-meteo-fields-for-scoring.md` — meaning of precipitation fields ("preceding hour" and day windows), WMO weather codes, soil moisture (m³/m³, no official saturation value), wind/heat/UV, marine fields, nulls.

## examples/
- `examples/README.md` — what each example shows, fixtures, Verified run and findings.
- `examples/01-flood-prognosis.mjs` — flood level for Miami and Fort Lauderdale on real 2026-11-25/26 data, with NWS floor overrides and partial-data reporting.
- `examples/02-beach-day-score.mjs` — beach-day score with vetoes, NWS heat index and EPA UV tip on real Miami Beach data.
- `examples/fixtures/` — real API responses (Open-Meteo, NOAA CO-OPS, NWS).
