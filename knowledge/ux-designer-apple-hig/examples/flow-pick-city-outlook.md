# Flow spec: pick a city -> see the outlook

Owner: Wren (ux-designer-apple-hig). Visuals: Sable. Build: pwa-mobile-engineer. Tests: qa-engineer.
Based on: docs/01-use-case-and-scoring.md, data-freshness-offline and risk-communication skills,
knowledge docs 01-05 in this folder.

Copy lines use the format `> [ID] text` so `readability.mjs` can check them.
`{city}`, `{time}` etc. are placeholders filled at runtime.

## User goal
"Tell me, in five seconds, whether my part of South Florida is likely to flood today and
whether it is a beach day."

## Entry points
- First visit (no saved city) -> City picker.
- Return visit -> Outlook for the last city (saved in localStorage).
- Cities tab -> City picker with the current city checked.

## Steps
1. City picker shows the 12 starter cities grouped by county, plus "Use My Location".
2. Person taps a city (or allows location and we pick the nearest listed city).
3. Outlook opens at once: cached data (with age) or a loading skeleton.
4. Fresh data replaces the skeleton/cached values; the time stamp updates.

## Screens
### S1 City picker (sheet on return visits, full screen on first visit)
- Title, native search field filtering the list, list rows (44 px min height), "Use My
  Location" row at the top. Native `<select>` fallback is acceptable.
> [PICK-TITLE] Choose your city
> [PICK-HELP] Pick the place you want flood and beach news for. You can change it any time.
> [PICK-LOC] Use My Location
> [PICK-LOC-HELP] Finds the closest city in our list. Your location stays on this phone.
> [PICK-LOC-DENIED] Location is off for this site. Pick a city from the list instead.
> [PICK-EMPTY-SEARCH] No city matches "{query}". We cover 12 cities in Miami-Dade, Broward, Palm Beach and Monroe counties.

### S2 Outlook
Order (top to bottom): top bar (city + Change City) -> official alerts -> flood card ->
beach card -> details link -> notice -> attribution. Tab bar at the bottom.

## States
| ID | State | Trigger | What shows |
|---|---|---|---|
| ST1 | Loading, no cache | first fetch for this city | Skeleton cards in final layout, indeterminate indicator, notice still visible |
| ST2 | Loading, cache present | revisit | Cached outlook with its age; small "Updating" label in top bar |
| ST3 | Loaded | all sources OK | Full outlook |
| ST4 | Partial | one source failed (for example NOAA tides) | Outlook with a line naming the missing source |
| ST5 | Error, no cache | all fetches fail, nothing cached | Error card + Try Again |
| ST6 | Offline / stale | offline, or data older than 3 h | Banner at top + cached outlook with age |
| ST7 | Alerts unknown | alert data older than 30 min or NWS failed | "Alert status unknown" line above the flood card |
| ST8 | Empty (no city) | storage cleared | City picker (S1) |

> [LOAD-1] Getting the latest forecast for {city}…
> [LOAD-UPDATING] Updating…
> [PARTIAL-TIDES] Tide times are missing right now. The flood level uses rain and alerts only.
> [ERR-TITLE] Can't load the forecast
> [ERR-BODY] Check your connection, then try again. For official alerts, go to weather.gov.
> [ERR-BTN] Try Again
> [STALE-BANNER] Offline. This forecast is from {age} ago. Check NWS for current alerts.
> [ALERT-UNKNOWN] Alert status unknown. We couldn't reach the National Weather Service.
> [UPDATED] Updated {time} · Open-Meteo, NOAA, NWS

## Official alert banner (any level)
> [NWS-HEAD] NWS: {event} until {end time}
> [NWS-SUB] This alert is from the National Weather Service.
> [NWS-LINK] Read the full alert

## Risk-level content (flood card)
Badge = word + icon + colour. Lead sentence = level + when + main reason with a number.

| Level | Lead example | Hint |
|---|---|---|
| Low | [LOW-LEAD] | none |
| Elevated | [ELEV-LEAD] | [ELEV-HINT] |
| High | [HIGH-LEAD] | [HIGH-HINT] |
| Severe | [SEV-LEAD] | [SEV-HINT] |

> [LOW-LEAD] Flood risk today: Low. Only light rain is expected, and the high tide is normal.
> [ELEV-LEAD] Flood risk today: Elevated. About 1 in of rain may fall on wet ground this afternoon.
> [ELEV-HINT] Some low streets may get water. Check again before you drive.
> [HIGH-LEAD] Flood risk tomorrow: High. 4 to 6 in of rain may fall on wet ground, with high tide at 7:42 pm.
> [HIGH-HINT] Street flooding is likely in low areas. Never drive through flood water.
> [SEV-LEAD] Flood risk today: Severe. The National Weather Service has issued a Flash Flood Warning.
> [SEV-HINT] Follow the National Weather Service and local officials now. Turn Around Don't Drown.
> [UNCERTAIN] Street flooding depends on local drainage we can't see.
> [NOTICE] Flood Watch is not an official warning service. Follow the National Weather Service and local emergency officials.
> [CREDIT] Weather data by Open-Meteo.com

Beach card (from beach-day-score skill): score, label, top two reasons.
> [BEACH-VETO] Skip it today. An official rip current warning is in effect.
> [BEACH-GOOD] Good beach day. Light wind and a low chance of rain.

## Acceptance criteria (testable)
1. AC1 First run: with empty storage, `/` shows S1; choosing "Miami Beach" shows S2 with
   heading containing "Miami Beach" within 1 tap.
2. AC2 Return: with a saved city and cached data, the outlook renders cached values and
   "Updated" time before any network response (mock network delay 5 s).
3. AC3 Order: in DOM order, the NWS banner (when present) precedes the flood card, which
   precedes the beach card.
4. AC4 Notice: [NOTICE] text is present in the outlook in every state ST1-ST7.
5. AC5 Each risk level fixture (Low/Elevated/High/Severe) renders the level word in text
   and an icon with `aria-hidden="true"`; no state relies on colour alone.
6. AC6 Override: a fixture with an active Flash Flood Warning and a computed "Low" shows
   "Severe" and the [NWS-HEAD] banner.
7. AC7 Offline: with the network offline and cache 4 h old, [STALE-BANNER] shows with
   "4 h"; alerts line shows [ALERT-UNKNOWN].
8. AC8 Error: offline with no cache shows [ERR-TITLE] in an element with `role="alert"`
   and a Try Again button >= 44 x 44 CSS px that refetches.
9. AC9 Live updates: when the level changes after refresh, the new lead sentence is in
   an `aria-live="polite"` region; the time stamp update alone is not announced.
10. AC10 Location denied: denying geolocation shows [PICK-LOC-DENIED]; no second prompt
    is triggered in the same session.
11. AC11 Accessibility: axe-core reports 0 violations for ST1, ST3, ST5, ST6 in light and
    dark; reflow at 320 px has no horizontal scroll; focused elements are never fully
    under the tab bar.
12. AC12 Copy: every line in this spec scores Flesch-Kincaid grade <= 8 in
    `readability.mjs`, or is listed as an accepted exception with a reason.

## Handoff
- Sable: visual spec for ST1-ST7 and four levels, light/dark, reduced transparency.
- flood-risk-scientist: confirm lead sentences and level meanings.
- qa-engineer: turn AC1-AC12 into Playwright tests with recorded fixtures.
