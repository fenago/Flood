Source: https://tidesandcurrents.noaa.gov/high-tide-flooding/
Source: https://tidesandcurrents.noaa.gov/high-tide-flooding/annual-outlook.html
Source: https://tidesandcurrents.noaa.gov/publications/techrpt86_PaP_of_HTFlooding.pdf
Source: https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/8723214/floodlevels.json
Source: https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/8723214/datums.json
Source: https://open-meteo.com/en/docs/marine-weather-api
Retrieved: 2026-11-26

# Tides, high tide flooding (HTF) and thresholds

## Definitions (NOAA)

- HTF: "the overflow or excess accumulation of water that covers typically dry coastal land and occurs
  during high tides" — happens "even on sunny days" (king tides in South Florida autumn).
- Outlooks: **Annual** (meteorological year May–April, regional summaries, projections to 2100),
  **Monthly** (daily likelihood up to a year ahead, per station), and an **experimental high-resolution
  monthly** outlook (includes "virtual stations"). The annual outlook counts days above the
  "NOS minor flood threshold" from Technical Report 086.
- 2026–27 annual outlook: the Southeast-region text names Duck NC (22–27 days), Wrightsville Beach and
  Mayport FL (up to 22). No Virginia Key/Miami figure on the page read (check the interactive map — unconfirmed).

## NOAA derived thresholds (Tech. Report NOS CO-OPS 086, Feb 2018)

Thresholds tied to the local great diurnal tide range GT (MHHW − MLLW), chosen to match the common
pattern of NWS impact thresholds:

| Level | Height above MHHW |
|---|---|
| Minor ("high tide flooding") | **0.04 × GT + 0.50 m** |
| Moderate | ≈ 0.03–0.04 × GT + 0.80 m (report: "0.80 m … with a small (3–4%) amplification") |
| Major | ≈ 0.03–0.04 × GT + 1.17 m |

## Virginia Key, FL (8723214) worked numbers

Datums (ft, station datum): MHHW 12.38, MLLW 10.13, GT 2.24 ft = 0.683 m.
- Derived minor = 0.04 × 0.683 + 0.50 = **0.527 m = 1.73 ft above MHHW**.
- Published `nos_minor` 14.07 → 14.07 − 12.38 = **1.69 ft** above MHHW (consistent with the formula).
- Published `nws_minor` 13.68 → **1.30 ft**; `nws_moderate` 1.70 ft; `nws_major` 2.50 ft above MHHW.
- Record: 15.945 ft on 2017-09-10 (Irma) = 3.57 ft above MHHW.

Use the **NWS minor (1.30 ft)** as the "tide near flooding" reference for Miami because it matches when
NWS issues coastal flood products locally; NOS minor (1.69 ft) is the national-comparison threshold. Both
are station values — streets in low spots (e.g. parts of Miami Beach) flood at lower water levels (unconfirmed, needs local data).

## How this feeds the flood score

Current model: `+2 points if coastal && predicted high tide > MHHW` (heuristic). Notes:
- With `datum=MHHW`, NOAA `v > 0` already means "above MHHW". On 2026-11-26 the highs were 0.53 and 0.36 ft —
  above MHHW (so +2) yet 0.77–0.94 ft below NWS minor. Consider a graded rule (heuristic, needs calibration):
  `v ≥ nws_minor − 0.5 ft` → +1, `v ≥ nws_minor` → +2.
- Predictions are **astronomical only**. Onshore wind, low pressure and the Gulf Stream add water. NWS still
  issued a Coastal Flood Statement on 2026-11-25 with predicted highs well under minor — so the NWS alert must win.
- Drainage: high tide blocks gravity outfalls, so heavy rain *at* high tide is worse. Prefer counting the tide
  only if a high tide falls within ±3 h of the rain peak (heuristic).

## Open-Meteo Marine sea level — caveats (verbatim limits)

`sea_level_height_msl` includes tides, inverted barometer and other terms; datum is global mean sea level.
Docs: "Accuracy is limited in coastal areas", "may be completely unreliable further inland", "not suitable
for coastal navigation". Resolution ~8 km (MeteoFrance SMOC). → Use only for rise/fall timing or as a
"surge-like anomaly" hint, never as a height vs. MHHW (different datum) and never for inland cities.
