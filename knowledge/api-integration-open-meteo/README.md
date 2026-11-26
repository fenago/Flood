# Knowledge — api-integration-open-meteo

Reference notes and worked examples for the agent that owns `src/api/` (Open-Meteo, NOAA CO-OPS, NWS clients).
Read the matching doc before touching a client; cite the Source URL at the top of each doc.

Last verified: 2026-11-26

## docs/
- `docs/01-open-meteo-forecast-api.md` — Forecast endpoint, params, multi-location array + `location_id` quirk, offset-less times + `utc_offset_seconds`/DST, field meanings and unit strings, 400/503 errors.
- `docs/02-open-meteo-marine-api.md` — Marine endpoint, `cell_selection` (default `sea`), variables/units (SST in °C), models, sea-level caveat, real Miami Beach capture.
- `docs/03-open-meteo-geocoding-terms-licence.md` — Geocoding search rules and fields; free-tier limits (600/min, 5,000/h, 10,000/day, 300,000/month), Netlify IP warning, CC BY 4.0 attribution markup.
- `docs/04-noaa-coops-tides.md` — CO-OPS datagetter params (`hilo`, `MHHW`, `lst_ldt`), response quirks (string `v`, offset-less `t`), Virginia Key datums and flood levels.
- `docs/05-nws-alerts-api.md` — `alerts/active` by point/area/zone, User-Agent rule, rate limit, GeoJSON fields, `expires` vs `ends`, severity pitfalls.

## examples/
- `examples/README.md` — what each example shows, fixture provenance, and the Verified run.
- `examples/01-parse-open-meteo.mjs` — batched Forecast/Marine URLs and a robust parser (times, units, nulls, errors).
- `examples/02-tides-and-alerts.mjs` — NOAA tide and NWS alert parsing, DST-safe, "still in force" rule.
- `examples/fixtures/` — real API responses captured 2026-11-25/26 (see examples/README.md).
