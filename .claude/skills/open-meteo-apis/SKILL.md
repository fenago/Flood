---
name: open-meteo-apis
description: Call the Open-Meteo Forecast, Marine and Geocoding APIs correctly from the browser for Flood Watch - endpoints, exact field names, units, terms and attribution. Use when fetching or parsing weather or marine data.
user-invocable: false
---
# Open-Meteo APIs

Call from the **browser**, not Functions (Open-Meteo rate-limits per IP and warns about Netlify). No API key.

| API | Endpoint |
|---|---|
| Forecast | `https://api.open-meteo.com/v1/forecast` |
| Marine | `https://marine-api.open-meteo.com/v1/marine` (use `cell_selection=sea` for beaches) |
| Geocoding | `https://geocoding-api.open-meteo.com/v1/search?name=` |
| Flood (GloFAS rivers; not used in v1 scoring) | `https://flood-api.open-meteo.com/v1/flood` |

Common params: `latitude`, `longitude` (comma-separated for several places), `timezone=America/New_York`, `temperature_unit=fahrenheit`, `wind_speed_unit=mph`, `precipitation_unit=inch`, `forecast_days` (≤16), `past_days` (≤92).

Fields we use:
- Hourly forecast: `precipitation, precipitation_probability, rain, showers, weather_code, cape, soil_moisture_0_to_1cm, soil_moisture_3_to_9cm, wind_speed_10m, wind_gusts_10m, wind_direction_10m, uv_index, apparent_temperature, temperature_2m, relative_humidity_2m, cloud_cover, is_day`
- Daily forecast: `precipitation_sum, precipitation_hours, precipitation_probability_max, uv_index_max, wind_gusts_10m_max, apparent_temperature_max, sunrise, sunset`
- Marine hourly: `wave_height, wave_period, wave_direction, swell_wave_height, swell_wave_period, sea_surface_temperature, sea_level_height_msl`

Parsing: `hourly.time[i]` aligns with `hourly.<var>[i]`; values can be `null` — treat as missing, never 0.

Caveats: marine sea level is ~8 km resolution, "not suitable for coastal navigation", may be unreliable inland → trend only.

Terms: non-commercial, < 10,000 calls/day, 5,000/h, 600/min; show "Weather data by Open-Meteo.com" (CC BY 4.0) with a link. Batch cities per request and cache to stay well under limits.
