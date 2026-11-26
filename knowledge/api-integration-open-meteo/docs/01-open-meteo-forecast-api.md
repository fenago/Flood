Source: https://open-meteo.com/en/docs
Retrieved: 2026-11-26

# Open-Meteo Forecast API

Endpoint: `GET https://api.open-meteo.com/v1/forecast` — no key for free, non-commercial use.
(Commercial use needs `apikey` and a `customer-` server prefix; not us.)

## URL parameters we use

| Param | Default | Notes for Flood Watch |
|---|---|---|
| `latitude`, `longitude` | required | WGS84. Comma-separate for several places: `latitude=25.7617,26.1224&longitude=-80.1918,-80.1373`. Use negative longitudes for the Americas. |
| `hourly` | — | Comma list or repeated `&hourly=`. |
| `daily` | — | If you ask for daily vars, the docs say `timezone` is **required**. |
| `current` | — | Current-conditions vars (not used in v1). |
| `temperature_unit` | `celsius` | Send `fahrenheit`. |
| `wind_speed_unit` | `kmh` | Send `mph` (others: `ms`, `kn`). |
| `precipitation_unit` | `mm` | Send `inch`. |
| `timeformat` | `iso8601` | Or `unixtime` (seconds since 1970 UTC). |
| `timezone` | `GMT` | Send `America/New_York`. `auto` resolves from coordinates. Comma list allowed for multi-location. |
| `past_days` | 0 | 0–92. We use `past_days=3` for antecedent rain (R72past). |
| `forecast_days` | 7 | 0–16. |
| `forecast_hours`, `past_hours`, `forecast_minutely_15`, `past_minutely_15` | — | Count from the current hour / 15-min step instead of the current day. |
| `start_date`, `end_date` | — | `yyyy-mm-dd`. |
| `models` | auto | Default `best_match` "automatically combines the most suitable weather models". Leave it. |
| `cell_selection` | `land` | `land` (90 m DEM, similar elevation), `sea`, `nearest`. Land is right for rain at a city. |
| `elevation` | DEM | `elevation=nan` disables downscaling. Leave default. |

15-minutely data: "Only available in Central Europe and North America" — South Florida is covered, so peak-intensity (Rmax) can later use `minutely_15=precipitation`.

## Response shape (one location)

`latitude`, `longitude` (centre of the grid cell actually used — "might be a few kilometres away"),
`elevation`, `generationtime_ms`, `utc_offset_seconds`, `timezone`, `timezone_abbreviation`,
`hourly` + `hourly_units`, `daily` + `daily_units`.
`hourly.time[i]` lines up with `hourly.<var>[i]` (parallel arrays).

**Multiple locations:** "the JSON output changes to a list of structures". Verified in our capture
(`examples/fixtures/forecast-miami-ftl-2026-11-25.json`): top level is an array, and the 2nd+ entries
carry `"location_id": 1, 2…` while the first entry has **no** `location_id`. Use the array index, not
`location_id`, to map back to the requested city.

## Time handling (important)

- Docs: timestamps use "ISO 8601 format with a fixed offset, utc_offset_seconds, resolved at request time".
- Reality (our capture): strings have **no offset suffix**, e.g. `"2026-11-25T14:00"`; offset is only in
  `utc_offset_seconds` (`-18000` = EST, `timezone_abbreviation` came back as `"GMT-5"`).
- "Daylight saving time (DST) changes within the requested range are ignored." So on the DST-change days
  (2nd Sunday of March, 1st Sunday of November) local labels after the switch are off by one hour.
- Correct conversion: `Date.UTC(y,m-1,d,h,mi) - utc_offset_seconds*1000`. Never `new Date("2026-11-25T14:00")`
  (that parses as the *device's* local time).
- For DST-exact local times, docs advise `timeformat=unixtime` + convert with the returned `timezone`.
- Daily boundaries also use the request-time offset.

## Variables we use (meaning from the docs)

| Var | Meaning (short) | Unit with our params |
|---|---|---|
| `precipitation` | rain + showers + snow, "sum of the preceding hour" | inch |
| `precipitation_probability` | chance of >0.1 mm in the preceding hour, from ensemble models at 0.25° (~27 km) | % |
| `rain` / `showers` | large-scale rain / convective showers, preceding hour | inch |
| `weather_code` | WMO code (95, 96, 99 = thunderstorm family) | `wmo code` |
| `cape` | convective available potential energy | J/kg (unconfirmed) |
| `soil_moisture_0_to_1cm` … `_27_to_81cm` | volumetric water content at 0–1, 1–3, 3–9, 9–27, 27–81 cm | m³/m³ |
| `apparent_temperature` | feels-like: wind chill + humidity + solar radiation | °F |
| `uv_index` | average of the preceding hour (`uv_index_clear_sky` = no clouds) | (blank unit) |
| `wind_speed_10m`, `wind_gusts_10m` | gusts = max of preceding hour | `mp/h` (sic, real unit string) |
| `cloud_cover` | total cloud area fraction | % |
| `is_day` | 1 day, 0 night | — |
| daily `precipitation_sum`, `precipitation_hours`, `precipitation_probability_max`, `uv_index_max` | daily aggregates | inch / h / % / — |

Note the unit strings to assert in parser tests: `"inch"`, `"mp/h"`, `"°F"`, `"%"`, `"wmo code"`, `"m³/m³"`.

## Nulls and errors

- Values may be `null` (model gaps, end of range). Keep as `null`; never coerce to 0. (Docs table does not
  spell this out — behaviour from project experience, unconfirmed on the page.)
- Bad parameter → **HTTP 400** with `{"error": true, "reason": "..."}`.
- We also captured **HTTP 503** `{"reason":"The service is overloaded","error":true}` on 2026-11-25
  (`examples/fixtures/error-503-overloaded.json`). Retry 5xx/429 with backoff; never retry 400.

## Past days are model data

`past_days` returns the model's own past hours (reanalysis/forecast), not rain-gauge observations
(unconfirmed wording). Our capture shows 17.2 in for Miami on 2026-11-25 while NWS forecast "most likely
2–4 inches" — treat model past rain as an estimate, and say so.
