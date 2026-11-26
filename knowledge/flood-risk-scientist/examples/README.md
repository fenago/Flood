# Examples — flood-risk-scientist

Zero-dependency Node (>= 18) scripts that score REAL data captured on 2026-11-25/26, the day NWS Miami
had a Flood Watch for the east-coast metro areas. They show what correct scoring looks like; numbers in
`CONFIG`/`F` mirror the skills and are heuristics unless marked SOURCED.

| File | What it shows |
|---|---|
| `01-flood-prognosis.mjs` | R24/Rmax from hourly "preceding hour" precipitation over the local-day window T01:00..T24:00; R72past from `past_days=3` labelled "estimate"; soil (heuristic 0.27 m³/m³); tide from NOAA `datum=MHHW` only where a station is confirmed; missing wind/tide reported as "Partial data", never scored as 0; NWS alerts matched by UGC zone and time overlap and applied as a floor; reasons with numbers; the not-official notice. |
| `02-beach-day-score.mjs` | 10:00–16:00 window; vetoes (NWS Rip Current/Beach Hazards Statement, any flood/tropical/surge Warning, WMO 95/96/97/99, gusts ≥ 30 mph, waves ≥ 2 m) capping the score at 10; weighted comfort factors; NWS heat index from `temperature_2m` + `relative_humidity_2m` (WPC algorithm) instead of `apparent_temperature`; SST °C → °F; EPA UV tip; a what-if run without the alert. |

## Fixtures (real; see ../../api-integration-open-meteo/examples/README.md for the exact request URLs)

- `forecast-miami-ftl-2026-11-25.json` — Open-Meteo forecast, Miami + Fort Lauderdale, `past_days=3`, inch units.
- `forecast-miami-beach-beachday-2026-11-25.json` — Open-Meteo forecast, Miami Beach, beach variables, °F/mph.
- `marine-miami-beach-2026-11-25.json` — Open-Meteo Marine, `cell_selection=sea`.
- `noaa-hilo-8723214-mhhw-2026-11-26.json` — NOAA tide highs/lows, Virginia Key, datum MHHW.
- `noaa-8723214-floodlevels.json`, `noaa-8723214-datums-trimmed.json` — station thresholds/datums (docs/02).
- `nws-alerts-mfl-east-coast-2026-11-25.json` — the 5 NWS Miami alerts for zones FLZ068/072/074/168/172/173 from the `alerts/active?area=FL` capture (references removed).

## Verified

Command (2026-11-26, Node v22.23.5):
```
cd knowledge/flood-risk-scientist/examples && node 01-flood-prognosis.mjs && node 02-beach-day-score.mjs
```
Output summary (both exit 0):
- Miami 2026-11-25: **Severe (9 pts)** — 17.2 in/24 h (model), bursts 3.8 in/h, soil 0.29; partial: tide, wind.
- Miami 2026-11-26: model **Elevated (5 pts)** = R72past 17.2 in (3) + high tide 0.53 ft above MHHW at 10:04 (2) → **raised to High by the NWS Flood Watch** (ends 01:00 that day); partial: rain 23/24 h, wind.
- Fort Lauderdale 2026-11-25: **Severe (9 pts)** — 6.8 in, bursts 4.4 in/h, soil 0.32; 11-26: model Elevated (3 pts) → High (Flood Watch); tide marked "no confirmed station".
- Beach, Miami Beach 2026-11-25: **10/100 "Skip it"** (capped from 55 by the NWS Rip Current Statement); what-if without alerts 55 "Meh". NWS heat index max 73.1 °F vs Open-Meteo apparent 79.3 °F; water 77.6 °F; UV 1 tip. Heat-index spot checks 90 °F/70 % → 105.9 °F and 96 °F/65 % → 121.0 °F (NWS chart values 106 and 121).

Findings for the owner (heuristics, not changed here):
- A day with 100 % rain chance and heavy-rain codes (65) all window still scores 55 "Meh" without the veto → consider a heavy-rain cap.
- WMO code 97 ("Heavy thunderstorm") is in Open-Meteo's table but not in the skill's veto list.
- The model's 17.2 in for Miami on 11-25 exceeds NWS's own worst case (5–7 in, locally 10+); single-cell model totals need a sanity cap or an "estimate" label.
