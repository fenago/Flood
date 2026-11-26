Source: https://api.tidesandcurrents.noaa.gov/api/prod/
Source: https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/8723214/datums.json
Source: https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/8723214/floodlevels.json
Retrieved: 2026-11-26

# NOAA CO-OPS Data API (tide predictions)

Data getter: `GET https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`

## Parameters

| Param | Values | Notes |
|---|---|---|
| `station` | 7-digit id | Virginia Key (Miami) = `8723214` (its datum control station is 8724580 Key West). |
| `product` | `predictions` | Also `water_level`, `hourly_height`, `high_low`, `datums` (docs: "no longer available" here; use the metadata API) ... |
| `interval` | `hilo`, `h`, or `1,5,6,10,15,30,60` (minutes) | "These are the only values accepted." `hilo` = high/low times and heights. |
| `datum` | `MHHW`, `MHW`, `MTL`, `MSL`, `MLW`, `MLLW`, `NAVD`, `STND`, ... | "Datum is mandatory for all water level products". Use `MHHW` so `v > 0` means "above normal high tide". |
| `time_zone` | `gmt`, `lst`, `lst_ldt` | `lst_ldt` = station local time **with** DST. Use it. |
| `units` | `english`, `metric` | english = feet. |
| `format` | `json`, `xml`, `csv` | |
| `begin_date`/`end_date` | `yyyyMMdd`, `yyyyMMdd HH:mm`, `MM/dd/yyyy`, `MM/dd/yyyy HH:mm` | or `begin_date`+`range` (hours), or `date=today|latest|recent`. |
| `application` | free text | An identifier for NOAA's logs, e.g. `FloodWatch`. No personal data. |

Length limits per request: `hilo` predictions up to **10 years**; other prediction intervals up to **1 year**.

## Response (real capture, 2026-11-26)

`...product=predictions&interval=hilo&datum=MHHW&time_zone=lst_ldt&units=english&format=json&station=8723214&begin_date=20261126&end_date=20261127&application=FloodWatch`

```json
{ "predictions" : [
{"t":"2026-11-26 03:32", "v":"-2.335", "type":"L"},{"t":"2026-11-26 10:04", "v":"0.527", "type":"H"}, ...]}
```
- `t` is local wall time with **no offset**, space-separated (`"YYYY-MM-DD HH:mm"`).
- `v` is a **string** → `Number(v)`. Feet relative to the requested datum.
- `type` is `"H"` or `"L"`.
- Error shape is different from Open-Meteo: `{"error": {"message": "..."}}` (HTTP status not stated; unconfirmed).

Fixture: `examples/fixtures/noaa-hilo-8723214-mhhw-2026-11-26.json`.

## Station metadata (Metadata API "mdapi")

Datums (`.../stations/8723214/datums.json?units=english`), feet on station datum (STND):
MHHW 12.38, MHW 12.30, MSL 11.26, MLLW 10.13, NAVD88 12.15, **GT (great diurnal range) 2.24 ft**.
Record max 15.945 ft STND on 2017-09-10 17:00 (Hurricane Irma) = **3.57 ft above MHHW**.

Flood levels (`.../stations/8723214/floodlevels.json`), same STND scale (scale inferred by matching the
datums values; the response has no units field — unconfirmed):

| Level | STND ft | ft above MHHW |
|---|---|---|
| `nws_minor` | 13.68 | **1.30** |
| `nws_moderate` | 14.08 | 1.70 |
| `nws_major` | 14.88 | 2.50 |
| `nos_minor` | 14.07 | 1.69 |
| `nos_moderate` | 15.04 | 2.66 |
| `nos_major` | 16.27 | 3.89 |

So "how close is the next high tide to flooding" = `v(MHHW) - 1.30` ft at Virginia Key. These are
station values; they do not describe every street. Hand interpretation to `flood-risk-scientist`.

## Gotchas

- Predictions are **astronomical tide only** — no surge, wind set-up or rain. On 2026-11-25 NWS had a
  Coastal Flood Statement for coastal Miami-Dade while the predicted highs for 11-26 were only 0.53 and
  0.36 ft above MHHW.
- Confirm any other station id in the station list before use (e.g. Lake Worth area) — unconfirmed here.
- The SRF product names other tide points ("Miami Harbor Entrance", "Lake Worth Pier"); those are not
  necessarily CO-OPS API station ids (unconfirmed).
- CORS: the API answered our scraper; browser CORS headers not checked here (unconfirmed). Add the host to
  CSP `connect-src` (already in docs/03-architecture.md).
