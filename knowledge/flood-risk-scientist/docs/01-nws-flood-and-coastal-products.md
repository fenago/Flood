Source: https://www.weather.gov/safety/flood-watch-warning
Source: https://www.weather.gov/lwx/warningsdefined
Source: https://api.weather.gov/alerts/active?point=25.7907,-80.13
Retrieved: 2026-11-26

# NWS flood, coastal and tropical products — what they mean and how we use them

NWS alerts are the ground truth. Our computed level can be raised by an alert, never lowered below it.

## Inland / rain flooding (weather.gov national safety page)

| Product | NWS tagline | Definition (short quotes) |
|---|---|---|
| **Flash Flood Warning** | "Take Action!" | "issued when a flash flood is imminent or occurring". Flash floods take "minutes to hours to develop" and can happen "in areas not immediately receiving rain". |
| **Flood Warning** | "Take Action!" | "issued when flooding is imminent or occurring". |
| **Flood Watch** | "Be Prepared" | "conditions are favorable for flooding. It does not mean flooding will occur, but it is possible." |
| **Flood Advisory** | "Be Aware" | flooding "not expected to be bad enough to issue a warning" but "may cause significant inconvenience". |

Flash Flood Warnings come in 3 tiers — "Base, Considerable, & Catastrophic" (LWX office page). The
tier is carried in alert parameters (field name not checked here — unconfirmed).

## Coastal and tropical (definitions from the NWS Sterling/LWX office page)

These are national product types; the wording below is LWX's. NWS Miami (MFL) wording may differ (unconfirmed).

| Product | Definition (short) |
|---|---|
| Coastal Flood **Warning** | "moderate to major coastal flooding is occurring or imminent" — "serious risk to life and property" |
| Coastal Flood **Watch** | "moderate to major coastal flooding is possible" |
| Coastal Flood **Advisory** | "minor or nuisance coastal flooding is occurring or imminent" |
| Coastal Flood **Statement** | Not defined on the pages read. Real MFL example (2026-11-25): "isolated minor coastal flooding … Some water on low lying roads and property", `severity: Minor`. |
| Storm Surge Warning / Watch | "danger" / "possibility" of "life-threatening inundation from rising tidal water moving inland", generally within 36 h / 48 h, with a tropical system |
| Hurricane Warning / Watch; Tropical Storm Warning / Watch | Tropical-cyclone winds (64+ kt / 34–63 kt) expected (warning, ~36 h) or possible (watch, ~48 h) |

## Mapping to Flood Watch (current skill rules + recommended additions)

| Alert `event` | Flood level floor | Notes |
|---|---|---|
| Flash Flood Warning, Flood Warning, Coastal Flood Warning | **Severe** | skill rule |
| Storm Surge Warning, Hurricane Warning | **Severe** | recommended (life-threatening inundation) — needs owner sign-off |
| Flood Watch, Coastal Flood Advisory | **High** | skill rule |
| Coastal Flood Watch, Storm Surge Watch, Hurricane Watch, Tropical Storm Warning | **High** | recommended — needs sign-off |
| Flood Advisory, Coastal Flood Statement | **Elevated** | recommended; these are "be aware" products |

Rules for applying an alert to a day: an alert applies to a forecast day if its window
`[onset ?? effective, ends ?? expires)` overlaps that local day. Key on `event`, not `severity`
(the API marked a Flood Watch `Severe` and a High-risk Rip Current Statement `Moderate`).
Show the NWS headline verbatim, first, above our level.

## Real case for calibration: 2026-11-25, NWS Miami Flood Watch

Captured from the API (FFAMFL, VTEC `/O.CON.KMFL.FA.A.0004.../`), valid until 2026-11-26 01:00 EST for
Metro + Coastal Palm Beach, Broward and Miami-Dade (UGC FLZ068, 072, 074, 168, 172, 173). Text says:
- "The last 30 days of rainfall has been 400 to 600 percent of normal" in Palm Beach/Broward and
  "200 to 300 percent" in Miami-Dade; ground "very saturated", "it will not take much rainfall".
- "Most likely amounts: 2-4 inches of rain." "Reasonable Worst Case (High-End): 5-7 inches … A few
  locations could see 10 or more inches."
- Open-Meteo model past-day values for the same date: Miami cell 17.21 in, Fort Lauderdale cell 6.78 in
  (see `examples/fixtures/forecast-miami-ftl-2026-11-25.json`). The Miami model total is far above the
  NWS worst case — a reminder that a single grid-cell model total is uncertain and must not be shown as fact.
- Same time: Coastal Flood Advisory (coastal Palm Beach & Broward), Coastal Flood Statement and a
  Rip Current Statement (coastal Miami-Dade).

Record this event in `docs/scoring-calibration.md` once observed rainfall (gauges/CoCoRaHS) is known
(observations not retrieved here).

## Wording rules that follow from the definitions

- Watch = possible, Warning = happening/imminent, Advisory = nuisance. Never call our "High" a "warning".
- Action language only from NWS (e.g. "Do not drive through flooded roadways" from the MFL instruction text).
- Always: "Flood Watch is not an official warning service. Follow the National Weather Service and local emergency officials."
