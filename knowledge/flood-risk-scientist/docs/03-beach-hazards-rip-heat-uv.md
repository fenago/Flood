Source: https://forecast.weather.gov/product.php?site=MFL&issuedby=MFL&product=SRF&format=txt&version=1&glossary=0
Source: https://www.weather.gov/phi/RiskDefinitions
Source: https://www.weather.gov/safety/ripcurrent-forecasts
Source: https://www.weather.gov/ama/heatindex
Source: https://www.weather.gov/safety/heat-index
Source: https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
Source: https://www.epa.gov/sites/default/files/documents/uviguide.pdf
Source: https://www.epa.gov/sunsafety/uv-index-scale-0
Retrieved: 2026-11-26

# Beach safety sources: rip currents, heat index, UV

## Rip current risk (NWS)

NWS Miami's Surf Zone Forecast (SRF, issued for FLZ168 Coastal Palm Beach, FLZ172 Coastal Broward,
FLZ173 Coastal Miami-Dade, FLZ069 Coastal Collier) defines:
- **Low** — "The risk for rip currents is low, however, life-threatening rip currents often occur in the vicinity of groins, jetties, reefs, and piers."
- **Moderate** — "Life-threatening rip currents are possible in the surf zone."
- **High** — "Life-threatening rip currents are likely in the surf zone."

Each zone/day also lists Surf Height, Thunderstorm Potential, Waterspout Risk, UV Index (as a word,
e.g. "Moderate"), Water Temperature, Winds, Tides, Sunrise/Sunset. (25 Nov 2026 issue: High risk in all
four zones for Thursday; 1–3 ft surf; west winds ~15 mph.)

In the alerts API a High risk appears as `event: "Rip Current Statement"` (seen with `severity: Moderate`)
— so veto on the event name, not on severity. `Beach Hazards Statement` is the other beach event to veto/flag
(definition not on the pages read — unconfirmed). The weather.gov/safety/ripcurrent-forecasts page only
lists offices that issue surf zone forecasts (MFL is one); it has no definitions.

Lightning risk (PHI office definitions, useful for wording): Low = isolated/widely scattered (20%);
Moderate = scattered (30–50%), "frequent cloud-to-ground lightning"; High = numerous/widespread (60–100%).

## Heat index (NWS)

"how hot it really feels when relative humidity is factored in with the actual air temperature."
Values assume shade and light wind; "exposure to full sunshine can increase heat index values by up to 15°F."

| Class | Heat index | Effect |
|---|---|---|
| Caution | 80–90 °F | fatigue possible with prolonged exposure/activity |
| Extreme Caution | 90–103 °F | heat stroke, cramps or exhaustion possible |
| Danger | 103–124 °F | cramps/exhaustion likely, heat stroke possible |
| Extreme Danger | 125 °F+ | heat stroke highly likely |

(The La Crosse ARX page uses an older 80–90 / 90–105 / 105–130 / 130+ table; the 103 °F Danger cut-off
used in our beach score matches the AMA page above.)

Algorithm (WPC): compute simple `HI = 0.5 × (T + 61 + (T−68)×1.2 + RH×0.094)`; average with T; if
that is ≥ 80 °F use the Rothfusz regression
`−42.379 + 2.04901523T + 10.14333127RH − 0.22475541T·RH − 0.00683783T² − 0.05481717RH² + 0.00122874T²RH + 0.00085282T·RH² − 0.00000199T²RH²`,
minus `((13−RH)/4)·√((17−|T−95|)/17)` if RH < 13 % and 80 ≤ T ≤ 112, plus `((RH−85)/10)·((87−T)/5)` if
RH > 85 % and 80 ≤ T ≤ 87. T in °F, RH in %.

**Important:** Open-Meteo `apparent_temperature` is *not* the NWS heat index — it also folds in wind and
solar radiation. If we label a band "NWS heat index", compute it from `temperature_2m` + `relative_humidity_2m`
with the algorithm above; otherwise call it "feels-like (Open-Meteo)" and mark the band as a heuristic.

## UV index (EPA)

EPA "A Guide to the UV Index" (PDF):

| Category | UVI | Key advice (short) |
|---|---|---|
| Low | 1–2 | sunglasses; sunscreen if you burn easily |
| Moderate | 3–5 | cover up, sunscreen; shade near midday |
| High | 6–7 | "Reduce time in the sun between 11 a.m. and 4 p.m." |
| Very High | 8–10 | "Unprotected skin will be damaged and can burn quickly"; try to avoid sun 11 a.m.–4 p.m. |
| Extreme | 11+ | "Unprotected skin can burn in minutes"; "white sand and other bright surfaces reflect UV" |

The PDF lists Miami's summer UV index as 10–11 (Very High–Extreme).
The current EPA web page (modified 2026-06-15) instead uses three bands: **1–2** "No protection needed";
**3–7** "Protection needed … SPF-15 or higher", shade late morning–mid-afternoon; **8+** "Extra protection
needed", "If your shadow is shorter than you, seek shade". Our tips follow the 5-band PDF wording (more
specific); if EPA withdraws the PDF, switch to the 3 bands. Note Open-Meteo `uv_index` is the average of the
preceding hour, so the midday peak can be slightly underestimated (inference).
