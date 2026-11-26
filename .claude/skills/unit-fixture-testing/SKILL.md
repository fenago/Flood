---
name: unit-fixture-testing
description: Write unit and fixture tests for Flood Watch scoring and API parsing using recorded Open-Meteo, NOAA and NWS responses. Use when adding or changing scoring logic, parsers or thresholds.
user-invocable: false
---
# Unit and fixture tests

- Runner: Vitest (or `node:test`); tests in `tests/unit/`.
- Scoring: table-driven tests — each row is inputs → expected level/score + reasons. Cover each band edge (just below, at, just above), each veto, each NWS override.
- Fixtures in `tests/fixtures/<source>/<case>.json`, recorded from real responses: dry day, heavy rain, king tide, thunderstorm, null values, DST change day, multi-city response.
- Every real South Florida flood event used for calibration becomes a named fixture with its date.
- Parsers: assert `hourly.time` alignment, `null` → missing, units as requested.
- A nightly (non-blocking) contract check calls each live API once and fails loudly if a field we use disappears.
