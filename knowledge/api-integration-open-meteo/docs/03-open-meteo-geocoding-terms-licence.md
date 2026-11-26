Source: https://open-meteo.com/en/docs/geocoding-api
Source: https://open-meteo.com/en/terms
Source: https://open-meteo.com/en/licence
Retrieved: 2026-11-26

# Open-Meteo Geocoding, terms, rate limits and attribution

## Geocoding API

Endpoint: `GET https://geocoding-api.open-meteo.com/v1/search`

| Param | Default | Notes |
|---|---|---|
| `name` | required | Place name or postal code. Can add `, <country or first-level admin area>` to narrow, e.g. `Hollywood, Florida`. |
| `count` | 10 | 1–100 (out of range → `{"error":true,"reason":"Parameter count must be between 1 and 100."}`). Filters run before the limit. |
| `language` | `en` | Lower-case; falls back to English/native name. |
| `countryCode` | — | ISO-3166-1 alpha-2, e.g. `US`. Use it — "Miami" alone matches places in several countries. |
| `format` | `json` | or `protobuf`. |

Matching rules: 2 characters = exact name only; 3+ = normalized **prefix** match (case- and
diacritic-insensitive); empty or 1 character returns nothing. The `, qualifier` must match exactly.
→ In the search box, don't call until the user has typed ≥ 3 characters; debounce.

Result fields (`results[]`): `id`, `name`, `latitude`, `longitude`, `elevation`, `feature_code`,
`country_code`, `country`, `country_id`, `admin1`–`admin4` (+ `_id`), `timezone`, `population`,
`postcodes`. For our region expect `admin1: "Florida"`, `timezone: "America/New_York"`.
When nothing matches, the `results` key may be absent (unconfirmed) — treat missing as `[]`.

Location data is from GeoNames (CC-BY, per the licence page).

Example: `https://geocoding-api.open-meteo.com/v1/search?name=Delray%20Beach&count=5&countryCode=US&language=en`

## Terms (free, non-commercial tier)

- "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute." Pricing table also shows
  **300,000 calls / month** for the free tier.
- Non-commercial only: OK = private/non-profit sites without subscriptions or ads; tip-jar donations OK.
  Not OK = subscriptions, ads, commercial products/promotion.
- You accept the CC-BY 4.0 licence.
- "We reserve the right to block applications and IP addresses that misuse our service without prior notice."
- "Rate limits are applied by IP addresses and application. If you are using providers like Vercel,
  Netlify, Render, or Google Sheets you might be rate-limited earlier then expected." → this is why
  Flood Watch calls Open-Meteo **from the browser**, never from a Netlify Function.
- Data comes with no warranty; Open-Meteo disclaims liability for inaccuracies or outages.
- Privacy: they may log IPs and keep server logs (which can contain coordinates) for 90 days.

### Staying under the limits (our guidance)

- One request per API per refresh, batching every saved city with comma-separated coordinates
  (each multi-location request still counts as at least one call; how multi-location calls are
  weighted is not stated on the terms page — unconfirmed).
- Debounce refresh to ≥ 10 min per city (`data-freshness-offline` skill); cache with `fetchedAt`.
- Ask only for variables we use; `forecast_days` no larger than the UI shows (7).
- On HTTP 429/5xx: exponential backoff with jitter (e.g. 1 s, 2 s, 4 s, max 3 tries), then show cached data.

## Licence and attribution

- API data licence: **CC BY 4.0**.
- Required credit, verbatim example from the licence page:
  ```html
  <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>
  ```
- You must give credit, link to the licence, and "include a link next to any location Open-Meteo
  data are displayed". If you change the data (our scores are derived data), "indicate if changes were made".
- Underlying sources are listed on the licence page (DWD, ECMWF, NOAA NCEP, Météo-France,
  Copernicus Marine, GeoNames, ...); the page does not say each must be credited separately by API
  users (unconfirmed). Marine screens can add "Wave data: Copernicus Marine / ECMWF via Open-Meteo".

Suggested footer for any screen showing Open-Meteo values:
`Weather data by Open-Meteo.com (CC BY 4.0). Scores are Flood Watch's own calculations.`
