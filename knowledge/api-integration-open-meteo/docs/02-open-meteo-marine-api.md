Source: https://open-meteo.com/en/docs/marine-weather-api
Retrieved: 2026-11-26

# Open-Meteo Marine API

Endpoint: `GET https://marine-api.open-meteo.com/v1/marine`

## Parameters

| Param | Default | Notes |
|---|---|---|
| `latitude`, `longitude` | required | Comma list for several points → array response (same as Forecast). |
| `hourly`, `daily`, `current` | — | Daily needs `timezone`. |
| `timezone` | `GMT` | Send `America/New_York`; same fixed-offset/DST rules as Forecast. |
| `timeformat` | `iso8601` | |
| `past_days` | 0 | 0–92. |
| `forecast_days` | **5 in the table** | 0–8. The prose says "Per default, 7 days" — the page contradicts itself; always send it explicitly. |
| `forecast_hours`, `past_hours`, `start_date`/`end_date`, `start_hour`/`end_hour` | — | |
| `length_unit` | `metric` | `imperial` converts heights (we keep metric; scoring thresholds are in metres). |
| `wind_speed_unit` | — | Not in the parameter table; the `ocean_current_velocity` row lists "km/h (mph, m/s, knots)", implying it (unconfirmed). |
| `cell_selection` | **`sea`** | Marine default is already `sea` (Forecast default is `land`). Still send `cell_selection=sea` explicitly for clarity. |

There is **no `temperature_unit`** in the Marine parameter table; `sea_surface_temperature` is
Celsius. Convert to °F in our client (`°F = °C × 9/5 + 32`). (Whether the Forecast-style
`temperature_unit` is silently accepted here: unconfirmed.)

## Hourly variables

| Var | Unit | Meaning |
|---|---|---|
| `wave_height` | m | Significant mean wave height (combined sea) |
| `wind_wave_height`, `swell_wave_height` (+ `secondary_`, `tertiary_`) | m | Wind-sea and swell components |
| `wave_direction` etc. | ° | Direction waves come **from** (0° = from north) |
| `wave_period`, `swell_wave_period`, ... | s | Mean period |
| `wind_wave_peak_period`, `swell_wave_peak_period` | s | Peak period |
| `ocean_current_velocity` / `_direction` | km/h / ° | Direction the current flows **towards** |
| `sea_surface_temperature` | °C | Near-surface water temperature |
| `sea_level_height_msl` | m | Tides + inverted barometer + sea-surface height + steric/mass terms; datum is global mean sea level, *not* lowest astronomical tide |
| `invert_barometer_height` | m | Pressure effect alone; already included in `sea_level_height_msl` |

Daily: `wave_height_max`, `wind_wave_height_max`, `swell_wave_height_max`, `wave_direction_dominant`,
`wave_period_max`, `swell_wave_period_max`, `*_peak_period_max`, etc.

## Models (selected rows)

| Model | Resolution | Step | Length | Updates |
|---|---|---|---|---|
| MeteoFrance MFWAM (waves) | 0.08° (~8 km) | 3-hourly | 10 d | every 12 h |
| MeteoFrance SMOC currents, tides | 0.08° (~8 km) | hourly | 10 d | every 24 h |
| MeteoFrance SST | 0.08° (~8 km) | 6-hourly | 10 d | every 24 h |
| ECMWF WAM | 9 km | hourly | 15 d | every 6 h |
| NCEP GFS Wave | 0.25° / 0.16° | hourly | 16 d | every 6 h |

## Caveat we must respect (sea level)

Docs, on `sea_level_height_msl`: "Accuracy is limited in coastal areas", it "may be completely
unreliable further inland", and "This data is not suitable for coastal navigation."
→ Use it only as a *trend/timing* hint for coastal cities. Official tide heights come from NOAA
CO-OPS (see 04-noaa-coops-tides.md). Never show it as a street flood depth.

## Real capture (Miami Beach, 2026-11-25)

Request: `latitude=25.7907&longitude=-80.13&hourly=wave_height,wave_period,swell_wave_height,sea_surface_temperature,sea_level_height_msl&timezone=America/New_York&cell_selection=sea&forecast_days=1`
- Cell returned: 25.791664, -80.12499 (offshore cell), `elevation` 6.0.
- Units: `"m"`, `"s"`, `"°C"`. `wave_height` 0.42–1.04 m; SST 25.0–25.5 °C (≈77–78 °F).
- `sea_level_height_msl` swung −0.66 to +0.43 m (two highs, ~08:00 and ~20:00 local: semi-diurnal tide
  shape). Good for "tide rising/falling" hints; the official high-tide time and height still come from NOAA.
- Fixture: `examples/fixtures/marine-miami-beach-2026-11-25.json`.
