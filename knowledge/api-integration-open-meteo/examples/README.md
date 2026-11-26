# Examples — api-integration-open-meteo

Runnable, zero-dependency Node (>= 18) scripts. By default they read the recorded fixtures in
`fixtures/`; pass `--live` to call the real APIs when the network allows.

| File | What it shows |
|---|---|
| `01-parse-open-meteo.mjs` | Builds batched Forecast + Marine URLs; parses single-object vs multi-location array responses (maps by index because the first entry has no `location_id`); converts offset-less times with `utc_offset_seconds`; asserts unit strings (`inch`, `wmo code`, `°C`); null-safe sums; cross-checks hourly sums against `daily.precipitation_sum`; classifies the real 503 and a 400 error as retryable or not; prints the attribution link. |
| `02-tides-and-alerts.mjs` | Builds the NOAA CO-OPS `hilo`/`MHHW`/`lst_ldt` URL; parses string heights and local times DST-safely (Intl, no library); compares highs with the Virginia Key NWS minor flood level; parses NWS alerts, drops Test/Cancel, uses `ends ?? expires` for "still in force", sorts by seriousness. |

## Fixtures (real responses captured 2026-11-25/26 via Firecrawl scrape of the API URLs)

| Fixture | Request |
|---|---|
| `forecast-miami-ftl-2026-11-25.json` | `api.open-meteo.com/v1/forecast?latitude=25.7617,26.1224&longitude=-80.1918,-80.1373&hourly=precipitation,precipitation_probability,weather_code,soil_moisture_0_to_1cm,wind_gusts_10m,apparent_temperature,uv_index&daily=precipitation_sum&timezone=America/New_York&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&past_days=3&forecast_days=2` — trimmed: `wind_gusts_10m`, `apparent_temperature`, `uv_index` removed; all other values verbatim. |
| `forecast-miami-beach-beachday-2026-11-25.json` | forecast for 25.7907,-80.13, beach-day hourly vars, `forecast_days=1` (verbatim). |
| `marine-miami-beach-2026-11-25.json` | marine for 25.7907,-80.13, `cell_selection=sea`, `forecast_days=1` (verbatim). |
| `error-503-overloaded.json` | real HTTP 503 body from the forecast API on 2026-11-25. |
| `noaa-hilo-8723214-mhhw-2026-11-26.json` | CO-OPS predictions, Virginia Key, 2026-11-26..27 (verbatim). |
| `noaa-8723214-floodlevels.json`, `noaa-8723214-datums-trimmed.json` | CO-OPS metadata API (datums trimmed to the rows we use). |
| `nws-alerts-point-miami-beach-2026-11-25.json` | The 3 alerts returned by `alerts/active?point=25.7907,-80.13`, taken from the same-time `area=FL` capture; `references` and `expiredReferences` removed. |

Note: the Open-Meteo "today" in these captures is 2026-11-25 (America/New_York), so `past_days=3` covers 11-22..11-24.

## Verified

Command (2026-11-26, Node v22.23.5):
```
cd knowledge/api-integration-open-meteo/examples && node 01-parse-open-meteo.mjs && node 02-tides-and-alerts.mjs
```
Output summary: both exit 0. Example 01 prints both grid cells (25.772915,-80.19832 and 26.109615,-80.12694),
first hour `2026-11-22T00:00` local = `05:00Z`, hourly-vs-daily sums agree (Miami 11-25: 17.210 vs 17.209 in;
Fort Lauderdale 6.784 vs 6.78 in), null demo `{"value":1.079,"missing":1}`, Miami Beach 12:00 waves 0.88 m,
water 25.4 °C = 77.7 °F, 503 → retryable true, 400 → retryable false. Example 02 prints four highs
0.53/0.36/0.46/0.30 ft above MHHW (0.77–1.00 ft below the 1.30 ft NWS minor level), DST sanity 16:00Z/17:00Z,
3 active alerts at 20:30 EST (Flood Watch, Rip Current Statement, Coastal Flood Statement) and only the
Rip Current Statement still active at 12:00 EST next day (its `ends` 19:00 outlives `expires` 10:00).
`--live` was not run: this container cannot reach the APIs.
