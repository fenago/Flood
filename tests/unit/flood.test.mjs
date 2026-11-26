// Flood prognosis on REAL captures from 2026-11-25/26 (NWS Miami Flood Watch day).
// Expected values match knowledge/flood-risk-scientist/examples/README.md "Verified".
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFlood } from "../../src/scoring/flood.js";
import { parseTides } from "../../src/api/noaa-tides.js";
import { parseAlerts } from "../../src/api/nws-alerts.js";
import { validateScoringConfig } from "../../src/scoring/config.js";
import { fx, config } from "../helpers/fixtures.mjs";

const forecast = fx("forecast-miami-ftl-2026-11-25.json");
const tides = parseTides(fx("noaa-hilo-8723214-mhhw-2026-11-26.json"));
const raw = fx("nws-alerts-mfl-east-coast-2026-11-25.json");
// The east-coast capture covers several zones; a point request would return only the city's zones.
const alertsFor = (zones) => parseAlerts({ features: raw.features.filter((f) => f.properties.geocode.UGC.some((z) => zones.includes(z))) }, new Date("2026-11-25T12:00:00-05:00"));
const MIAMI = { name: "Miami", coastal: true, tideStation: "8723214", onshoreFrom: [20, 160] };
const FTL = { name: "Fort Lauderdale", coastal: true, tideStation: null, onshoreFrom: [20, 160] };
const miamiAlerts = alertsFor(["FLZ074", "FLZ173"]);
const ftlAlerts = alertsFor(["FLZ072", "FLZ172"]);

test("scoring.json is valid and beach weights sum to 100", () => {
  assert.doesNotThrow(() => validateScoringConfig(config));
  assert.throws(() => validateScoringConfig({ ...config, beach: { ...config.beach, weights: { ...config.beach.weights, rain: 30 } } }), /sum to 100/);
});

test("Miami 2026-11-25: Severe, 9 points, reasons with numbers labelled as model estimates", () => {
  const r = scoreFlood({ forecast: forecast[0], tides, alerts: miamiAlerts, city: MIAMI, day: "2026-11-25", config });
  assert.equal(r.level, "Severe");
  assert.equal(r.points, 9);
  assert.equal(r.reasons[0].code, "rain24");
  assert.ok(Math.abs(r.reasons[0].inches - 17.21) < 0.01);
  assert.equal(r.reasons[0].estimate, true); // decision 4d
  assert.ok(r.reasons.find((x) => x.code === "rainBurst").inchesPerHour > 3.7);
  assert.ok(r.partial.some((p) => p.code === "tideMissing")); // NOAA fixture covers 11-26 only: missing, not 0
});

test("Miami 2026-11-26: model Elevated (5) raised to High by the NWS Flood Watch", () => {
  const r = scoreFlood({ forecast: forecast[0], tides, alerts: miamiAlerts, city: MIAMI, day: "2026-11-26", config });
  assert.equal(r.computedLevel, "Elevated");
  assert.equal(r.points, 5);
  assert.equal(r.level, "High");
  assert.equal(r.override, "Flood Watch");
  const tide = r.reasons.find((x) => x.code === "highTide");
  assert.deepEqual([tide.ft, tide.at], [0.527, "10:04"]);
  assert.deepEqual(r.partial.find((p) => p.code === "rainHours"), { code: "rainHours", have: 23, of: 24 });
});

test("Fort Lauderdale: Severe on 11-25; 11-26 Elevated (3) -> High; no confirmed tide station is reported", () => {
  const a = scoreFlood({ forecast: forecast[1], tides: null, alerts: ftlAlerts, city: FTL, day: "2026-11-25", config });
  assert.deepEqual([a.level, a.points], ["Severe", 9]);
  const b = scoreFlood({ forecast: forecast[1], tides: null, alerts: ftlAlerts, city: FTL, day: "2026-11-26", config });
  assert.deepEqual([b.computedLevel, b.points, b.level], ["Elevated", 3, "High"]);
  assert.ok(b.partial.some((p) => p.code === "tideNoStation"));
});

test("null rain hours are reported as partial data, never scored as 0", () => {
  const f = structuredClone(forecast[0]);
  const i = f.hourly.time.indexOf("2026-11-25T12:00");
  f.hourly.precipitation[i] = null;
  const r = scoreFlood({ forecast: f, tides, alerts: [], city: MIAMI, day: "2026-11-25", config });
  assert.deepEqual(r.partial.find((p) => p.code === "rainHours"), { code: "rainHours", have: 23, of: 24 });
  const none = { hourly: { time: f.hourly.time, precipitation: f.hourly.precipitation.map(() => null) } };
  assert.equal(scoreFlood({ forecast: none, tides, alerts: [], city: MIAMI, day: "2026-11-25", config }).level, null);
});

test("unknown alerts (NWS failed) are reported, and the computed level is kept", () => {
  const r = scoreFlood({ forecast: forecast[0], tides, alerts: null, city: MIAMI, day: "2026-11-26", config });
  assert.equal(r.level, "Elevated");
  assert.ok(r.partial.some((p) => p.code === "alertsUnknown"));
});

const synthetic = (event, onset = "2026-11-26T06:00:00-05:00", ends = "2026-11-27T06:00:00-05:00") =>
  [{ event, headline: event, onset: new Date(onset), until: new Date(ends) }];

test("decision 4e: Storm Surge / Hurricane Warnings floor at Severe; their Watches and Tropical Storm Warning at High", () => {
  const dry = { hourly: { time: forecast[1].hourly.time, precipitation: forecast[1].hourly.precipitation.map(() => 0), soil_moisture_0_to_1cm: forecast[1].hourly.time.map(() => 0.1) } };
  const lvl = (event) => scoreFlood({ forecast: dry, tides: null, alerts: synthetic(event), city: FTL, day: "2026-11-26", config }).level;
  assert.equal(lvl("Storm Surge Warning"), "Severe");
  assert.equal(lvl("Hurricane Warning"), "Severe");
  assert.equal(lvl("Flash Flood Warning"), "Severe");
  assert.equal(lvl("Storm Surge Watch"), "High");
  assert.equal(lvl("Hurricane Watch"), "High");
  assert.equal(lvl("Tropical Storm Warning"), "High");
  assert.equal(lvl("Coastal Flood Advisory"), "High");
  assert.equal(lvl("Flood Advisory"), "Elevated");
  assert.equal(lvl("Special Weather Statement"), "Low");
  // An alert that ended before the day does not apply.
  const old = scoreFlood({ forecast: dry, tides: null, alerts: synthetic("Hurricane Warning", "2026-11-24T00:00:00-05:00", "2026-11-25T12:00:00-05:00"), city: FTL, day: "2026-11-26", config });
  assert.equal(old.level, "Low");
});

test("an NWS floor never LOWERS a computed level", () => {
  const r = scoreFlood({ forecast: forecast[0], tides, alerts: synthetic("Flood Advisory", "2026-11-25T00:00:00-05:00", "2026-11-26T00:00:00-05:00"), city: MIAMI, day: "2026-11-25", config });
  assert.equal(r.level, "Severe");
  assert.equal(r.override, null);
});

test("onshore wind adds a point only from the onshore sector", () => {
  const base = { time: [], precipitation: [], wind_speed_10m: [], wind_direction_10m: [] };
  for (let h = 0; h < 24; h++) { base.time.push(`2026-11-26T${String(h).padStart(2, "0")}:00`); base.precipitation.push(0); base.wind_speed_10m.push(25); base.wind_direction_10m.push(90); }
  base.time.push("2026-11-27T00:00"); base.precipitation.push(0); base.wind_speed_10m.push(25); base.wind_direction_10m.push(90);
  const on = scoreFlood({ forecast: { hourly: base }, tides: null, alerts: [], city: FTL, day: "2026-11-26", config });
  assert.ok(on.reasons.some((r) => r.code === "onshoreWind"));
  const off = { ...base, wind_direction_10m: base.wind_direction_10m.map(() => 270) };
  assert.ok(!scoreFlood({ forecast: { hourly: off }, tides: null, alerts: [], city: FTL, day: "2026-11-26", config }).reasons.some((r) => r.code === "onshoreWind"));
});
