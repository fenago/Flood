Source: https://www.weather.gov/documentation/services-web-api
Source: https://api.weather.gov/alerts/active?point=25.7907,-80.13
Source: https://api.weather.gov/alerts/active?area=FL
Retrieved: 2026-11-26

# NWS API — active alerts

Base URL: `https://api.weather.gov`

## Requests

| Need | Request |
|---|---|
| Alerts at one place | `/alerts/active?point={lat},{lon}` (e.g. `point=25.7907,-80.13`) |
| All alerts in a state (docs call this "a common request") | `/alerts/active?area=FL` |
| One forecast zone | `/alerts/active/zone/{zoneId}` or `/alerts/active?zone=FLZ173` |
| Event names | `/alerts/types` |

"The /alerts/active endpoint redirects internally to the root /alerts endpoint with the
"active=true" parameter." Full filter list is in the page's Specification tab (not read here).

Batching cities: one `area=FL` call (we captured 31 features, ~200 KB) then match each city by UGC
zone code (`properties.geocode.UGC`, e.g. Miami Beach coast = `FLZ173`) — or one `point=` call per
city (~11 KB each). Point calls are simpler and smaller for ≤ 12 cities.

## Headers and limits

- "A User Agent is required to identify your application." Docs example:
  `User-Agent: (myweatherapp.com, contact@myweatherapp.com)`. Contact info is optional; we use
  `FloodWatch (site URL)` from `NWS_USER_AGENT`, never a personal email. "This will be replaced with an API key in the future."
- Browsers generally do not let `fetch` set `User-Agent` (unconfirmed for every browser) → if NWS
  rejects browser calls, use the `alerts` Netlify Function proxy (hand to `netlify-engineer`).
- Formats via `Accept`: `application/geo+json` (default), `application/ld+json`, `application/cap+json`, `application/atom+json`.
- Rate limit "is not public"; exceeding it returns an error that can be retried "typically within 5
  seconds". "Proxies are more likely to reach the limit" → cache the proxy response (5 min).
- Errors use the `ProblemDetail` schema (`application/problem+json`; fields not listed here — unconfirmed).

## Response shape (real capture, point = Miami Beach, 2026-11-25 ~20:00 EST)

GeoJSON `FeatureCollection` with `title`, `updated`, `features[]`. Each feature: `id` (alert URL),
`geometry` (was `null` for all three — zone-based alerts have no polygon), `properties`:

| Field | Example |
|---|---|
| `event` | `"Flood Watch"`, `"Coastal Flood Statement"`, `"Rip Current Statement"` |
| `headline` | `"Flood Watch issued November 25 at 2:49PM EST until November 26 at 1:00AM EST by NWS Miami FL"` |
| `severity` / `certainty` / `urgency` | `Severe` / `Possible` / `Future` (Flood Watch) |
| `sent`, `effective`, `onset`, `expires`, `ends` | ISO with offset, e.g. `2026-11-26T01:00:00-05:00` |
| `status`, `messageType` | `Actual`; `Alert` / `Update` / `Cancel` |
| `areaDesc`, `geocode.UGC`, `geocode.SAME`, `affectedZones` | zone list |
| `senderName` | `"NWS Miami FL"` |
| `description`, `instruction`, `response` | full text; `response` e.g. `Prepare`, `Monitor`, `Avoid` |
| `parameters.NWSheadline[0]`, `parameters.VTEC[0]` | e.g. `/O.CON.KMFL.FA.A.0004.../` |
| `eventCode.NationalWeatherService[0]` | `FAA` (Flood Watch), `CFS`, `RPS` |

Lessons from this capture:
- **`expires` ≠ `ends`.** The Rip Current Statement had `expires` 2026-11-26 10:00 but `ends` 19:00.
  `expires` is when this message should be replaced; `ends` is when the hazard is expected to end
  (CAP meaning — unconfirmed on the NWS page). For "is it still active?" use `ends ?? expires`, and
  refresh alerts at least every 30 min.
- `severity` is not the product level: Rip Current Statement came as `Moderate` although its text says
  "HIGH RIP CURRENT RISK". Key decisions on `event`, not `severity`.
- One product can carry two hazards: the "Coastal Flood Statement" headline also says
  "...HIGH RIP CURRENT RISK REMAINS IN EFFECT...".
- Skip `status !== "Actual"` (Test/Exercise) and `messageType === "Cancel"`.
- Show `headline` verbatim plus a link (`feature.id`, or `https://alerts.weather.gov`), never a rewrite.

Fixture (3 real features, `references`/`expiredReferences` removed to keep it small; taken from the
`area=FL` capture, same alert ids the point call returned): `examples/fixtures/nws-alerts-point-miami-beach-2026-11-25.json`.

## Other NWS data we may want later

- Surf Zone Forecast (Miami: product `SRF`, office `MFL`) has per-zone "Rip Current Risk" Low/Moderate/High,
  UV, tides. Text page: `https://forecast.weather.gov/product.php?site=MFL&issuedby=MFL&product=SRF`.
  API route via `/products/types/SRF/locations/MFL` — unconfirmed.
- `/points/{lat},{lon}` gives the office/grid; docs say grid mappings "may occasionally change", so re-check periodically.
