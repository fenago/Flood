Source: https://open-meteo.com/en/docs
Source: https://open-meteo.com/en/docs/marine-weather-api
Retrieved: 2026-11-26

# What the Open-Meteo numbers mean (for scoring)

## Precipitation

| Field | Meaning (docs) | Scoring use |
|---|---|---|
| `precipitation` | rain + showers + snow, "sum of the preceding hour" | R24 = sum of 24 hourly values; Rmax = max hourly value |
| `rain` | "Rain from large scale weather systems of the preceding hour" | split only for explanations |
| `showers` | "Showers from convective precipitation … from the preceding hour" | convective bursts drive street flooding |
| `precipitation_probability` | chance of > 0.1 mm in the preceding hour, from a 0.25° (~27 km) ensemble | beach "rain chance"; not used for flood amounts |
| daily `precipitation_sum` | sum for the local day | cross-check of R24 |
| daily `precipitation_hours` | "number of hours with rain" | duration hint |

"Preceding hour" means the value stamped `T14:00` fell between 13:00 and 14:00. So the strict local-day
window is `T01:00 … next-day T00:00`. Whether `precipitation_sum` uses that window or `T00:00 … T23:00`
is not stated (unconfirmed); in our 2026-11-25 capture both windows give the same totals. Pick one, document
it, and test the edge.

With `precipitation_unit=inch` the unit string is `"inch"`. 15-minute `precipitation` is available for North
America, so Rmax can later use true 15-min intensity (×4 → in/h) — the hourly max understates bursts.

**`past_days` values are model output, not gauge observations** (inference from how the API works;
the docs do not label them). Our Miami cell shows 17.21 in on 2026-11-25 vs NWS "most likely 2–4 in".
Label R72past "estimated recent rain".

## Thunderstorms and weather codes (WMO, as listed by Open-Meteo)

0 Clear sky · 1 Mainly clear · 2 Partly cloudy · 3 Overcast · 45 Fog · 48 Depositing rime fog ·
51/53/55 Drizzle light/moderate/dense · 56/57 Freezing drizzle · 61/63/65 Rain slight/moderate/heavy ·
66/67 Freezing rain · 71/73/75 Snowfall · 77 Snow grains · 80/81/82 Rain showers slight/moderate/violent ·
85/86 Snow showers · **95 Thunderstorm · 96 Thunderstorm with slight hail · 99 Thunderstorm with heavy hail**
(96/99 are starred on the page; footnote not captured — unconfirmed meaning, likely limited availability).

The docs table also lists **97 "Heavy thunderstorm"** (note: 97 is not in the beach-veto list 95/96/99 —
recommend adding it). `cape` (convective available potential energy) can support a "storms possible" reason.

## Soil moisture

`soil_moisture_0_to_1cm`, `_1_to_3cm`, `_3_to_9cm`, `_9_to_27cm`, `_27_to_81cm`: "Average soil water
content as volumetric mixing ratio" — unit `m³/m³` (fraction of soil volume that is water).
- Saturation depends on soil porosity (not given by Open-Meteo). There is no official "saturated" value
  in the docs → any threshold is a **heuristic**.
- Observed range in our capture: Miami cell 0.192 (dry, 11-24) → 0.291 (peak of the 11-25 rain);
  Fort Lauderdale 0.194 → 0.317. A relative rule (e.g. ≥ 0.27 or a rise of ≥ 0.05 in 24 h) separated the
  wet day here; it must be calibrated on more events before use.
- The 0–1 cm layer reacts within the hour and dries fast; `3_to_9cm` is a steadier "ground already wet" signal.
- NWS text is often the better antecedent signal ("30-day rainfall 400 to 600 percent of normal").

## Wind, heat, sun

- `wind_speed_10m` (mph), `wind_gusts_10m` = max of preceding hour (unit string `"mp/h"`).
  `wind_direction_10m` is the direction wind comes from; onshore for the Atlantic coast ≈ NE–SE (heuristic band, e.g. 30°–150°).
- `apparent_temperature`: "perceived feels-like temperature combining wind chill factor, relative humidity and
  solar radiation" — not the NWS heat index (see 03-beach-hazards-rip-heat-uv.md).
- `uv_index`: average of the preceding hour; `uv_index_clear_sky` ignores clouds.
- `cloud_cover`: total cloud area fraction, %.

## Marine fields

- `wave_height` (m): significant height of the combined sea; `swell_wave_height` for swell only.
- `sea_surface_temperature`: **°C** (no unit parameter) → convert for the 77–86 °F comfort band.
- `sea_level_height_msl`: tides + pressure + other terms vs global MSL; "may be completely unreliable further
  inland", "not suitable for coastal navigation" → trend only.
- Marine grid ~8 km (MFWAM/SMOC) to 25 km; nearshore surf can differ a lot from the cell value. NWS SRF surf
  height is authoritative.

## Nulls

Any `null` = missing. Never treat as 0 rain / 0 waves. Score with what is known, mark "partial data", and
lower confidence; if the main driver (R24) is mostly missing, do not show a level at all.
