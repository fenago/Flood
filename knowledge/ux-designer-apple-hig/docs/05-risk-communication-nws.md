Source: https://www.weather.gov/safety/flood-turn-around-dont-drown
Source: https://www.weather.gov/safety/ripcurrent-forecasts
Source: https://developer.apple.com/design/human-interface-guidelines/writing
Retrieved: 2026-11-26

# Risk communication with NWS guidance

The NWS rip current page is cited in docs/01-use-case-and-scoring.md; it was not
re-read for this note, so its wording here is limited to that doc's quote.

## Turn Around Don't Drown (NWS)
Facts stated on the NWS page (2026-11-26):
- About **6 inches** of fast-moving flood water can knock an adult over.
- About **12 inches** of rushing water can carry away most cars.
- About **2 feet** of rushing water can carry away SUVs and trucks.
- Over half of flood drownings happen when a vehicle is driven into flood water
  (NWS citing CDC).
- Core message: it is never safe to drive or walk into flood water.
- Never drive around barriers on a flooded road; the road under the water may be gone.
"Turn Around Don't Drown" is an NWS registered mark: quote it as their message,
attribute it to NWS, and link to the page. Do not restyle it as our slogan.

## Message order on every flood screen
1. **Official alerts first**, headline verbatim with source and end time:
   "NWS: Flash Flood Warning until 9:00 pm".
2. **Our level** in one sentence: level + when + main reason with a number.
   "Flood risk tomorrow: High — 4–6 in of rain on already wet ground, high tide 7:42 pm."
3. **Reasons** (2-3 bullets with numbers), then **what we don't know**:
   "Street flooding depends on local drainage we can't see."
4. **Action hints only from official sources** (High/Severe): "Never drive through flood
   water. Turn Around Don't Drown (NWS)."
5. **Always visible notice**: "Flood Watch is not an official warning service. Follow
   the National Weather Service and local emergency officials."
6. **Freshness**: "Updated 10:05 am · Open-Meteo, NOAA, NWS".

## Level wording (draft for flood-risk-scientist to confirm)
| Level | One-line meaning | Hint |
|---|---|---|
| Low | Flooding is unlikely. | none |
| Elevated | Some low streets may get water. | Check again before you drive. |
| High | Street flooding is likely in low areas. | Never drive through flood water. |
| Severe | Serious flooding is possible or an official warning is active. | Follow NWS and local officials now. |

## Tone rules (from the risk-communication skill + HIG Writing)
- Calm, direct, no jokes or hype, no exclamation marks.
- 8th-grade reading level or lower (we measure with Flesch-Kincaid; see examples).
- US units by default with a toggle.
- Never say "safe". Say "Low" and what that means.
- Uncertainty in plain words; avoid percentages unless the source gives them.
- When our data is stale or alerts can't be checked, say so before showing a level.

## Overrides
- An active NWS flood/coastal warning forces our level to at least Severe; a watch or
  advisory to at least High (docs/01). The UI shows the alert as the reason:
  "Severe because the National Weather Service issued a Flash Flood Warning."
