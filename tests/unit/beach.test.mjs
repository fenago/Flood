// Beach-day score on REAL Miami Beach captures (2026-11-25) plus the decision-4 fixes (a, b, c).
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreBeach } from "../../src/scoring/beach.js";
import { heatIndexF, heatClass, uvCategory } from "../../src/scoring/heat.js";
import { parseAlerts } from "../../src/api/nws-alerts.js";
import { fx, config } from "../helpers/fixtures.mjs";

const wx = fx("forecast-miami-beach-beachday-2026-11-25.json");
const marine = fx("marine-miami-beach-2026-11-25.json");
const alerts = parseAlerts(fx("nws-alerts-point-miami-beach-2026-11-25.json"), new Date("2026-11-25T09:00:00-05:00"));
const day = "2026-11-25";

test("real day: NWS Rip Current Statement vetoes -> 10/100 Skip it (capped from 55)", () => {
  const r = scoreBeach({ forecast: wx, marine, alerts, day, config });
  assert.equal(r.raw, 55);
  assert.equal(r.score, 10);
  assert.equal(r.label, "Skip it");
  assert.deepEqual(r.reasons[0], { code: "nwsBeach", event: "Rip Current Statement" });
  assert.ok(Math.abs(r.values.water - 77.6) < 0.1); // SST °C -> °F
});

test("decision 4b: heavy rain most of the window caps the score at 35 even without alerts (was 55 Meh)", () => {
  const r = scoreBeach({ forecast: wx, marine, alerts: [], day, config });
  assert.equal(r.raw, 55);
  assert.equal(r.heavyRain, true);
  assert.equal(r.score, 35);
  assert.equal(r.label, "Skip it");
  assert.equal(r.reasons[0].code, "heavyRain");
});

test("decision 4a: WMO 97 (heavy thunderstorm) is a veto like 95/96/99", () => {
  for (const code of [95, 96, 97, 99]) {
    const f = structuredClone(wx);
    f.hourly.weather_code = f.hourly.weather_code.map(() => 1);
    f.hourly.weather_code[f.hourly.time.indexOf(`${day}T13:00`)] = code;
    const r = scoreBeach({ forecast: f, marine, alerts: [], day, config });
    assert.equal(r.score <= 10, true, `code ${code}`);
    assert.deepEqual(r.vetoes[0], { code: "thunder", wmo: code });
  }
});

test("decision 4c: heat uses the NWS heat index (WPC) from temperature + humidity, not apparent_temperature", () => {
  const r = scoreBeach({ forecast: wx, marine, alerts: [], day, config });
  assert.ok(Math.abs(r.heat.index - 73.1) < 0.1, String(r.heat.index));
  const apparentMax = Math.max(...wx.hourly.apparent_temperature.filter((_, i) => /T1[0-6]:/.test(wx.hourly.time[i])));
  assert.ok(apparentMax > 79); // Open-Meteo feels-like is higher on this day; we do not use it
  assert.equal(Math.round(heatIndexF(90, 70)), 106); // NWS chart value
  assert.equal(Math.round(heatIndexF(96, 65)), 121);
  assert.equal(heatClass(106), "Danger");
  assert.equal(heatClass(85), "Caution");
  assert.equal(heatClass(70), null);
});

test("EPA UV categories", () => {
  assert.deepEqual([1, 3, 6, 8, 10, 11, 12].map(uvCategory), ["low", "moderate", "high", "veryHigh", "veryHigh", "extreme", "extreme"]);
});

test("a calm sunny synthetic day scores Great; gusts >= 30 mph and waves >= 2 m veto", () => {
  const hours = Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, "0")}:00`);
  const c = (v) => hours.map(() => v);
  const f = { hourly: { time: hours, temperature_2m: c(84), relative_humidity_2m: c(55), precipitation_probability: c(5), weather_code: c(1), wind_speed_10m: c(8), wind_gusts_10m: c(14), cloud_cover: c(30), uv_index: c(6) } };
  const m = { hourly: { time: hours, wave_height: c(0.4), sea_surface_temperature: c(27) } };
  const great = scoreBeach({ forecast: f, marine: m, alerts: [], day, config });
  assert.ok(great.score >= 80, String(great.score));
  assert.equal(great.label, "Great beach day");
  const gusty = scoreBeach({ forecast: { hourly: { ...f.hourly, wind_gusts_10m: c(31) } }, marine: m, alerts: [], day, config });
  assert.equal(gusty.score, 10);
  const wavy = scoreBeach({ forecast: f, marine: { hourly: { ...m.hourly, wave_height: c(2.1) } }, alerts: [], day, config });
  assert.equal(wavy.vetoes[0].code, "waves");
  const noMarine = scoreBeach({ forecast: f, marine: null, alerts: null, day, config });
  assert.ok(noMarine.partial.includes("waves") && noMarine.partial.includes("alerts"));
});
