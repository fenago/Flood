---
name: noaa-nws-apis
description: Use NOAA CO-OPS tide predictions and National Weather Service alerts in Flood Watch. Use when adding tides, king-tide timing, or official flood, coastal and rip-current alerts.
user-invocable: false
---
# NOAA tides and NWS alerts

## NOAA CO-OPS (tides)
`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&interval=hilo&datum=MLLW&time_zone=lst_ldt&units=english&format=json&station=<id>&begin_date=YYYYMMDD&end_date=YYYYMMDD&application=FloodWatch`
- Stations: Virginia Key 8723214 (Miami). Confirm others (e.g. Lake Worth ICW 8722669) in the station list before use.
- Compare predicted highs to MHHW (use `datum=MHHW` for a "height above normal high tide" view).

## NWS alerts
`https://api.weather.gov/alerts/active?point={lat},{lon}`
- Send a `User-Agent` identifying the app (from `NWS_USER_AGENT`; no personal email). If browsers cannot set it, proxy through the `alerts` Function with a 5-minute cache.
- Event names to handle: Flash Flood Warning, Flood Warning, Flood Watch, Flood Advisory, Coastal Flood Warning/Advisory/Watch, Rip Current Statement, Beach Hazards Statement, Hurricane/Tropical Storm Warning/Watch, Storm Surge Warning/Watch.
- Show headline, severity, `effective`/`expires`, and a link to the full text. Official alerts override our scores.
