// Parser and URL tests on recorded Open-Meteo, NOAA and NWS responses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { forecastUrl, marineUrl, parseForecast, parseMarine, getForecast } from "../../src/api/open-meteo.js";
import { tideUrl, parseTides } from "../../src/api/noaa-tides.js";
import { nwsAlertsUrl, parseAlerts, getAlerts } from "../../src/api/nws-alerts.js";
import { fetchJson, ApiError } from "../../src/api/fetch-json.js";
import { localToDate, wallTimeToDate, localYmd, addDays } from "../../src/shared/time.js";
import { fx, cities } from "../helpers/fixtures.mjs";

const miami = cities.find((c) => c.id === "miami");

test("12 starter cities with ids, coordinates; only Virginia Key is used as a confirmed tide station", () => {
  assert.equal(cities.length, 12);
  assert.equal(new Set(cities.map((c) => c.id)).size, 12);
  for (const c of cities) assert.ok(c.lat > 24 && c.lat < 27.5 && c.lon < -79.9 && c.lon > -82);
  assert.deepEqual([...new Set(cities.map((c) => c.tideStation).filter(Boolean))], ["8723214"]);
});

test("forecast URL uses exact Open-Meteo field names and US units", () => {
  const u = new URL(forecastUrl(miami));
  assert.equal(u.origin + u.pathname, "https://api.open-meteo.com/v1/forecast");
  assert.equal(u.searchParams.get("timezone"), "America/New_York");
  assert.equal(u.searchParams.get("precipitation_unit"), "inch");
  assert.equal(u.searchParams.get("past_days"), "3");
  for (const v of ["precipitation", "soil_moisture_0_to_1cm", "wind_direction_10m", "relative_humidity_2m", "uv_index"]) assert.ok(u.searchParams.get("hourly").split(",").includes(v), v);
  const m = new URL(marineUrl(miami));
  assert.equal(m.hostname, "marine-api.open-meteo.com");
  assert.equal(m.searchParams.get("cell_selection"), "sea");
});

test("parsers accept the real captures and reject wrong units / misaligned arrays", () => {
  const f = parseForecast(fx("forecast-miami-ftl-2026-11-25.json"));
  assert.equal(f.hourly.time[0], "2026-11-22T00:00");
  assert.equal(parseForecast(fx("forecast-miami-beach-beachday-2026-11-25.json")).units.wind_speed_10m, "mp/h");
  assert.equal(parseMarine(fx("marine-miami-beach-2026-11-25.json")).units.sea_surface_temperature, "°C");
  const bad = fx("forecast-miami-beach-beachday-2026-11-25.json");
  bad.hourly_units.temperature_2m = "°C";
  assert.throws(() => parseForecast(bad), /unit/);
  const mis = fx("forecast-miami-beach-beachday-2026-11-25.json");
  mis.hourly.uv_index.pop();
  assert.throws(() => parseForecast(mis), /misaligned/);
});

test("fetchJson classifies the real 503 as retryable and reads X-Fetched-At from the service worker cache", async () => {
  const body503 = fx("error-503-overloaded.json");
  const f503 = async () => new Response(JSON.stringify(body503), { status: 503 });
  await assert.rejects(fetchJson("Open-Meteo", "https://x", { fetchImpl: f503 }), (e) => e instanceof ApiError && e.retryable && e.status === 503);
  const f400 = async () => new Response(JSON.stringify({ error: true, reason: "bad" }), { status: 400 });
  await assert.rejects(fetchJson("Open-Meteo", "https://x", { fetchImpl: f400 }), (e) => !e.retryable);
  const net = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(fetchJson("NWS", "https://x", { fetchImpl: net }), (e) => e.status === 0 && e.retryable);
  const cached = async () => new Response("{}", { status: 200, headers: { "X-Fetched-At": "2026-11-26T10:00:00.000Z" } });
  const r = await fetchJson("x", "https://x", { fetchImpl: cached });
  assert.equal(r.fromCache, true);
  assert.equal(r.fetchedAt.toISOString(), "2026-11-26T10:00:00.000Z");
  const live = await getForecast(miami, { fetchImpl: async () => new Response(JSON.stringify(fx("forecast-miami-beach-beachday-2026-11-25.json"))) });
  assert.equal(live.fromCache, false);
});

test("NOAA tides: URL params, string heights, DST-safe local times", () => {
  const u = new URL(tideUrl("8723214", "2026-11-26", "2026-11-28"));
  assert.deepEqual(["product", "interval", "datum", "time_zone", "begin_date", "end_date"].map((k) => u.searchParams.get(k)), ["predictions", "hilo", "MHHW", "lst_ldt", "20261126", "20261128"]);
  const t = parseTides(fx("noaa-hilo-8723214-mhhw-2026-11-26.json"));
  const highs = t.filter((x) => x.type === "high").map((x) => x.ftAboveMHHW);
  assert.deepEqual(highs, [0.527, 0.361, 0.457, 0.301]);
  assert.equal(t[1].time.toISOString(), "2026-11-26T15:04:00.000Z"); // 10:04 EST
  assert.throws(() => parseTides({ error: { message: "No Predictions data was found" } }), /No Predictions/);
});

test("NWS alerts: drops Cancel/Test, uses ends ?? expires, sorts by seriousness", () => {
  const raw = fx("nws-alerts-point-miami-beach-2026-11-25.json");
  const at = (s) => parseAlerts(raw, new Date(s)).map((a) => a.event);
  assert.deepEqual(at("2026-11-25T20:30:00-05:00"), ["Flood Watch", "Rip Current Statement", "Coastal Flood Statement"]);
  assert.deepEqual(at("2026-11-26T12:00:00-05:00"), ["Rip Current Statement"]); // ends 19:00 outlives expires 10:00
  const cancelled = structuredClone(raw);
  cancelled.features.forEach((f) => { f.properties.messageType = "Cancel"; });
  assert.deepEqual(parseAlerts(cancelled, new Date("2026-11-25T20:30:00-05:00")), []);
  assert.throws(() => parseAlerts({ nope: 1 }), /FeatureCollection/);
  assert.equal(nwsAlertsUrl(25.7907, -80.13), "https://api.weather.gov/alerts/active?point=25.7907,-80.1300");
});

test("NWS client never sends a custom header (no CORS preflight from the browser)", async () => {
  let seen;
  await getAlerts(miami, { fetchImpl: async (url, init) => { seen = init; return new Response(JSON.stringify({ features: [] })); } });
  assert.equal(seen.headers, undefined);
});

test("time helpers are DST-safe", () => {
  assert.equal(wallTimeToDate(2026, 7, 1, 12, 0).toISOString(), "2026-07-01T16:00:00.000Z");
  assert.equal(wallTimeToDate(2026, 12, 1, 12, 0).toISOString(), "2026-12-01T17:00:00.000Z");
  assert.equal(localToDate("2026-03-08T03:00").toISOString(), "2026-03-08T07:00:00.000Z"); // first EDT hour
  assert.equal(localYmd(new Date("2026-11-26T03:00:00Z")), "2026-11-25");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
