// Mocked API responses built from the REAL recorded fixtures (tests/fixtures/).
import { readFileSync } from "node:fs";
const fx = (n) => JSON.parse(readFileSync(new URL(`../fixtures/${n}`, import.meta.url), "utf8"));

// Miami-area forecast: rain/soil from the 120-hour Miami capture, beach variables from the Miami Beach capture.
function buildForecast() {
  const base = fx("forecast-miami-ftl-2026-11-25.json")[0];
  const beach = fx("forecast-miami-beach-beachday-2026-11-25.json");
  const hourly = { ...base.hourly };
  for (const v of ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "wind_speed_10m", "wind_gusts_10m", "cloud_cover", "uv_index"]) {
    hourly[v] = base.hourly.time.map((t) => { const i = beach.hourly.time.indexOf(t); return i === -1 ? null : beach.hourly[v][i]; });
  }
  hourly.wind_direction_10m = base.hourly.time.map(() => 270); // offshore (not in captures)
  // beach-day capture's weather codes for 11-25 override the Miami cell's
  hourly.weather_code = base.hourly.time.map((t, j) => { const i = beach.hourly.time.indexOf(t); return i === -1 ? base.hourly.weather_code[j] : beach.hourly.weather_code[i]; });
  return { ...base, hourly, hourly_units: { ...base.hourly_units, ...beach.hourly_units, wind_direction_10m: "°" } };
}

export const FORECAST = buildForecast();
export const MARINE = fx("marine-miami-beach-2026-11-25.json");
export const TIDES = fx("noaa-hilo-8723214-mhhw-2026-11-26.json");
export const ALERTS = fx("nws-alerts-point-miami-beach-2026-11-25.json");
export const NO_ALERTS = { type: "FeatureCollection", features: [] };
// Fixed "now": 2026-11-25 09:00 EST, the morning of the NWS Miami Flood Watch day.
export const NOW = new Date("2026-11-25T09:00:00-05:00");

export const URLS = {
  forecast: /https:\/\/api\.open-meteo\.com\/v1\/forecast\?/,
  marine: /https:\/\/marine-api\.open-meteo\.com\/v1\/marine\?/,
  tides: /https:\/\/api\.tidesandcurrents\.noaa\.gov\/api\/prod\/datagetter\?/,
  alerts: /https:\/\/api\.weather\.gov\/alerts\/active\?/,
};

/** Route all four APIs on a page or context. `over` replaces a response: { alerts: 500 } or { alerts: NO_ALERTS }. */
export async function mockApis(target, over = {}, state = { offline: false }) {
  const bodies = { forecast: FORECAST, marine: MARINE, tides: TIDES, alerts: ALERTS };
  const seen = [];
  for (const [k, re] of Object.entries(URLS)) {
    await target.route(re, (route) => {
      seen.push(route.request().url());
      if (state.offline) return route.abort("internetdisconnected");
      const o = over[k];
      if (typeof o === "number") return route.fulfill({ status: o, body: "error" });
      return route.fulfill({ json: o ?? bodies[k], headers: { "access-control-allow-origin": "*" } });
    });
  }
  return seen;
}
