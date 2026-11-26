# 01 · Use case, data sources and scoring

> Research date: 2026-11-26. Everything marked **(verify)** should be checked in a quick spike before code depends on it.

## 1. The use case

People in South Florida have watched the same streets flood again and again: rain bursts on saturated ground, king tides, and storm surge all add up. Flood Watch (working name) is a phone-first, installable web app where a user:

1. **Picks a South Florida city** (or uses their location).
2. **Sees a flood prognosis** for the next 1–7 days: a plain-language risk level (Low / Elevated / High / Severe) with the reasons behind it (heavy rain, wet ground, high tide, an official NWS alert).
3. **Sees a "beach day" score** for the same place: is it a good day to go to the beach, and if not, why not.
4. **Works offline** with the last forecast it fetched, clearly labelled with its age.

What it is **not**: an official warning system. Every flood screen must defer to National Weather Service (NWS) alerts and local emergency management, and say so.

### Starter city list (coordinates approximate, verify against the geocoder)

| City | County | Lat | Lon | Coastal? |
|---|---|---|---|---|
| Miami | Miami-Dade | 25.7617 | -80.1918 | yes |
| Miami Beach | Miami-Dade | 25.7907 | -80.1300 | yes |
| Hialeah | Miami-Dade | 25.8576 | -80.2781 | no |
| Homestead | Miami-Dade | 25.4687 | -80.4776 | near |
| Key West | Monroe | 24.5551 | -81.7800 | yes |
| Hollywood | Broward | 26.0112 | -80.1495 | yes |
| Fort Lauderdale | Broward | 26.1224 | -80.1373 | yes |
| Pompano Beach | Broward | 26.2379 | -80.1248 | yes |
| Boca Raton | Palm Beach | 26.3683 | -80.1289 | yes |
| Delray Beach | Palm Beach | 26.4615 | -80.0728 | yes |
| West Palm Beach | Palm Beach | 26.7153 | -80.0534 | yes |
| Jupiter | Palm Beach | 26.9342 | -80.0942 | yes |

Ship this as a static JSON file. Open-Meteo also has a free geocoding endpoint (`https://geocoding-api.open-meteo.com/v1/search?name=...`) for a "search any city" box later **(verify)**.

## 2. Data sources

### 2.1 Open-Meteo Forecast API (rain, wind, UV, heat)

- Endpoint: `https://api.open-meteo.com/v1/forecast` — required `latitude`, `longitude`. Several locations can be requested in one call with comma-separated coordinates.
- `forecast_days` up to **16**; `past_days` 0–**92** (useful for "how much rain fell in the last 3 days").
- Units: `temperature_unit=fahrenheit`, `wind_speed_unit=mph`, `precipitation_unit=inch`, `timezone=America/New_York`.
- 15-minutely data exists for North America, so short-term rain intensity is available.
- Response shape: `{ latitude, longitude, elevation, timezone, hourly: { time: [...], <var>: [...] }, hourly_units: {...}, daily: {...} }` — parallel arrays keyed by variable name.

Variables we need:

| Purpose | Hourly | Daily |
|---|---|---|
| Rain | `precipitation`, `precipitation_probability`, `rain`, `showers` | `precipitation_sum`, `precipitation_hours`, `precipitation_probability_max` |
| Storms | `weather_code` (WMO codes; 95–99 = thunderstorm), `cape` | `weather_code` |
| Ground saturation | `soil_moisture_0_to_1cm`, `soil_moisture_1_to_3cm`, `soil_moisture_3_to_9cm` | — |
| Wind | `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m` | `wind_speed_10m_max`, `wind_gusts_10m_max`, `wind_direction_10m_dominant` |
| Sun/heat | `uv_index`, `apparent_temperature`, `temperature_2m`, `relative_humidity_2m`, `cloud_cover`, `is_day` | `uv_index_max`, `apparent_temperature_max`, `sunrise`, `sunset` |

### 2.2 Open-Meteo Marine API (waves, sea temperature, sea level)

- Endpoint: `https://marine-api.open-meteo.com/v1/marine`.
- Hourly: `wave_height`, `wave_direction`, `wave_period`, `wind_wave_height`, `swell_wave_height`, `swell_wave_period`, `swell_wave_direction`, `sea_surface_temperature`, `ocean_current_velocity`, `ocean_current_direction`, `sea_level_height_msl`, `invert_barometer_height`.
- Daily: `wave_height_max`, `swell_wave_height_max`, `wave_period_max`, `wave_direction_dominant`.
- Models include MeteoFrance MFWAM (~8 km), ECMWF WAM (9 km), NCEP GFS Wave (~16–25 km).
- Use `cell_selection=sea` for beach points so the API picks an ocean grid cell, not a land cell.
- **Docs caveat (quote):** sea-level and tide data are computed at ~8 km resolution; "accuracy at coastal areas is limited… not suitable for coastal navigation", and `sea_level_height_msl` "may be completely unreliable further inland". So: use it as a *trend* signal for coastal cities, never as an inland street-level flood depth.

### 2.3 Open-Meteo Flood API (river discharge) — low value here

- Endpoint: `https://flood-api.open-meteo.com/v1/flood`, daily `river_discharge` (+ mean/median/min/max/p25/p75), GloFAS ~5 km, up to 210 days, `ensemble=true` for members.
- The docs warn it returns the largest river within a ~5 km cell. South Florida floods are mostly rain on flat, saturated ground, canals and tides, not big rivers. **Recommendation:** leave it out of v1 scoring; at most show it as an experimental chart.

### 2.4 Authoritative US sources to add (free, no key)

| Source | Why | Notes |
|---|---|---|
| **NWS API** `https://api.weather.gov/alerts/active?point={lat},{lon}` | Official Flood Watch/Warning, Flash Flood Warning, Coastal Flood Advisory, Rip Current Statement, Hurricane/Tropical warnings | Requires a `User-Agent` header identifying the app. **Any active flood/coastal alert overrides our computed score.** |
| **NOAA CO-OPS Data API** `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&interval=hilo&datum=MLLW&station=...&format=json` | Official high/low tide predictions; drives "king tide" timing | Stations: Virginia Key 8723214 (Miami; record max 3.56 ft above MHHW in Sep 2017), Lake Worth ICW 8722669 **(verify)**. |
| **NOAA High Tide Flooding Outlooks** (tidesandcurrents.noaa.gov/high-tide-flooding) | Monthly/annual expected flood-tide days | Link out or scrape later; useful context in autumn king-tide season. |
| **NWS Surf Zone Forecast (Miami office, MFL)** | Official rip current risk Low/Moderate/High | Text product; available via api.weather.gov products **(verify endpoint/format)**. |

### 2.5 Terms and rate limits (Open-Meteo)

From the Open-Meteo terms: free use is **non-commercial only**, under **10,000 calls/day, 5,000/hour, 600/minute, 300,000/month**, with **CC BY 4.0 attribution** required ("Weather data by Open-Meteo.com" with a link). Subscriptions, ads, or commercial promotion require the paid API.

Important for architecture: the terms say limits are applied per IP and "if you are using providers like Vercel, **Netlify**, Render… you might be rate-limited earlier than expected." **So the browser should call Open-Meteo directly** (each user has their own IP), not proxy through Netlify Functions. See [03-architecture.md](03-architecture.md).

## 3. Flood prognosis score

A transparent, rule-based score is better than a black box here: the user must be able to see *why* it says "High". Compute per day (and a "next 6 hours" now-cast).

**Inputs**

| Signal | Field(s) | Rationale |
|---|---|---|
| R24 — rain in 24 h | sum of hourly `precipitation` | Main driver of street flooding |
| Rmax — peak hourly rain | max hourly `precipitation` (or 15-min) | Drains are overwhelmed by intensity, not just totals |
| R72past — rain already fallen | `past_days=3` → sum | Antecedent wetness |
| Soil | `soil_moisture_0_to_1cm` / `_3_to_9cm` | Saturated ground cannot absorb more |
| Tide | CO-OPS high-tide height vs. MHHW; Marine `sea_level_height_msl` trend | High tide blocks drainage outfalls; king tides flood on sunny days |
| Wind push | onshore `wind_speed_10m` (E/NE winds on the Atlantic coast) | Piles water against the coast |
| Official alerts | NWS alerts | Ground truth; always wins |

**Algorithm sketch (heuristic — tune with local history)**

```
points = 0
points += band(R24,  [1, 2, 4, 6] in)       -> 0..4
points += band(Rmax, [0.5, 1, 2, 3] in/h)   -> 0..4
points += band(R72past, [2, 4, 6] in)       -> 0..3
points += soilNearSaturation ? 1 : 0
points += coastal && highTideAboveMHHW ? 2 : 0
points += coastal && onshoreWind >= 20 mph ? 1 : 0
level = points <= 2 ? Low : points <= 5 ? Elevated : points <= 8 ? High : Severe
if NWS Flash Flood Warning / Flood Warning / Coastal Flood Warning active -> level = max(level, Severe)
if Flood Watch / Coastal Flood Advisory active -> level = max(level, High)
```

The band thresholds are **product heuristics, not official criteria**. South Florida's NWS office issues Flood Advisories and Flash Flood Warnings using local knowledge of drainage; we cannot replicate that, which is exactly why the official alert overrides everything. A later version can calibrate thresholds against historical events (Open-Meteo has a historical weather API) and the user's own "it flooded on this day" reports.

## 4. Beach-day score (0–100)

Two stages: **hard vetoes**, then a **weighted comfort score**.

### 4.1 Hard vetoes (score capped at 10, reason shown)

| Condition | Source / rationale |
|---|---|
| NWS High Rip Current Risk or Rip Current Statement | NWS: High risk means "life-threatening rip currents are likely in the surf zone" ([weather.gov/safety/ripcurrent-forecasts](https://www.weather.gov/safety/ripcurrent-forecasts)) |
| Thunderstorm in the beach window: `weather_code` 95, 96 or 99 | WMO weather codes as documented by Open-Meteo; lightning on an open beach is the classic danger |
| Any active tropical, flood, or coastal flood warning | NWS alerts |
| `wind_gusts_10m` ≥ 30 mph | Heuristic (Beaufort 6+ "strong breeze": sand blowing, rough surf) |
| `wave_height` ≥ 2 m (~6.5 ft) | Heuristic; well above typical South Florida beach surf |

### 4.2 Weighted score (for 10:00–16:00 local)

| Factor (weight) | Best | Worse | Source |
|---|---|---|---|
| Rain chance (25) | `precipitation_probability` ≤ 20 % | ≥ 60 % → 0 | Heuristic |
| Feels-like heat (15) | `apparent_temperature` 78–90 °F | ≥ 103 °F → 0 | NWS heat index: 90–105 °F "sunstroke, heat cramps and heat exhaustion possible"; 103 °F+ is the NWS "Danger" band ([NOAA chart](https://www.noaa.gov/sites/default/files/2022-05/heatindex_chart_rh.pdf), [weather.gov/arx/heat_index](https://www.weather.gov/arx/heat_index)) |
| Wind (15) | `wind_speed_10m` 5–12 mph | ≥ 25 mph → 0 | Heuristic, Beaufort scale |
| Waves (15) | `wave_height` ≤ 0.6 m | ≥ 1.5 m → 0 | Heuristic rip/swim comfort proxy; NWS surf forecast is authoritative |
| Water temp (10) | `sea_surface_temperature` 77–86 °F | ≤ 70 °F → 0 | Heuristic comfort |
| Sky (10) | `cloud_cover` 10–50 % | 100 % → 3 | Heuristic |
| UV (10) | `uv_index` ≤ 7 | 11+ → 3 | EPA: 8–10 "Very High… unprotected skin can burn quickly", 11+ "Extreme… can burn in minutes", and white sand reflects UV ([EPA UV guide](https://www.epa.gov/sites/default/files/documents/uviguide.pdf)). Miami averages 10–11 in summer per the same guide, so UV mainly drives *advice*, not a veto. |

Labels: 80–100 "Great beach day", 60–79 "Good", 40–59 "Meh", < 40 "Skip it". Always show the top 2 reasons and a UV tip ("UV 10: seek shade 11 a.m.–4 p.m., SPF 15+" per EPA).

### 4.3 Why this design

- Vetoes mirror how lifeguards and NWS actually communicate risk (categorical warnings), while weights cover comfort.
- Every number is a field Open-Meteo actually returns (names verified against the docs above).
- Weights live in one JSON config so a "beach-scoring" agent can tune them without touching code.

## Sources

- Open-Meteo Forecast API docs — https://open-meteo.com/en/docs
- Open-Meteo Marine API docs — https://open-meteo.com/en/docs/marine-weather-api
- Open-Meteo Flood API docs — https://open-meteo.com/en/docs/flood-api
- Open-Meteo Terms — https://open-meteo.com/en/terms
- API directory where the project found Open-Meteo — https://mcp-api.netlify.app/
- NWS API web service — https://www.weather.gov/documentation/services-web-api
- NOAA CO-OPS Data API — https://api.tidesandcurrents.noaa.gov/api/prod/ ; Virginia Key station — https://tidesandcurrents.noaa.gov/stationhome.html?id=8723214
- NOAA High Tide Flooding Outlooks — https://tidesandcurrents.noaa.gov/high-tide-flooding/
- NWS rip current risk levels — https://www.weather.gov/safety/ripcurrent-forecasts
- EPA UV Index scale — https://www.epa.gov/sunsafety/uv-index-scale-0 and guide PDF above
- NWS/NOAA heat index — links above
