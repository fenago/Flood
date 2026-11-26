// Worked example: build Open-Meteo Forecast + Marine URLs for several cities, then parse the
// responses into clean per-city objects (Date times, nulls kept, units checked, errors classified).
//
// Run against recorded fixtures (default):   node 01-parse-open-meteo.mjs
// Run against the live APIs (needs network): node 01-parse-open-meteo.mjs --live
//
// Zero dependencies. Node 18+ (global fetch). Docs: ../docs/01-*.md, ../docs/02-*.md
import { readFile } from 'node:fs/promises';

const LIVE = process.argv.includes('--live');
const here = (p) => new URL(p, import.meta.url);

const CITIES = [
  { id: 'miami', name: 'Miami', lat: 25.7617, lon: -80.1918 },
  { id: 'fort-lauderdale', name: 'Fort Lauderdale', lat: 26.1224, lon: -80.1373 },
];

// ---- URL builders ---------------------------------------------------------------------------
export function forecastUrl(cities, { pastDays = 3, forecastDays = 2 } = {}) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', cities.map((c) => c.lat).join(','));
  u.searchParams.set('longitude', cities.map((c) => c.lon).join(','));
  u.searchParams.set('hourly', 'precipitation,precipitation_probability,weather_code,soil_moisture_0_to_1cm');
  u.searchParams.set('daily', 'precipitation_sum'); // daily => timezone required
  u.searchParams.set('timezone', 'America/New_York');
  u.searchParams.set('temperature_unit', 'fahrenheit');
  u.searchParams.set('wind_speed_unit', 'mph');
  u.searchParams.set('precipitation_unit', 'inch');
  u.searchParams.set('past_days', String(pastDays));
  u.searchParams.set('forecast_days', String(forecastDays));
  return u.toString();
}

export function marineUrl(cities) {
  const u = new URL('https://marine-api.open-meteo.com/v1/marine');
  u.searchParams.set('latitude', cities.map((c) => c.lat).join(','));
  u.searchParams.set('longitude', cities.map((c) => c.lon).join(','));
  u.searchParams.set('hourly', 'wave_height,wave_period,swell_wave_height,sea_surface_temperature,sea_level_height_msl');
  u.searchParams.set('timezone', 'America/New_York');
  u.searchParams.set('cell_selection', 'sea');
  u.searchParams.set('forecast_days', '1'); // always explicit: Marine default is ambiguous in docs
  return u.toString();
}

// ---- Errors -----------------------------------------------------------------------------------
export class OpenMeteoError extends Error {
  constructor(status, reason) {
    super(`Open-Meteo ${status}: ${reason}`);
    this.status = status;
    // 400 = our bug (bad param) -> never retry. 429/5xx (e.g. 503 "overloaded") -> retry with backoff.
    this.retryable = status === 429 || status >= 500;
  }
}

export function checkBody(status, body) {
  if (body && body.error === true) throw new OpenMeteoError(status, body.reason ?? 'unknown');
  if (status >= 400) throw new OpenMeteoError(status, 'HTTP error without JSON reason');
  return body;
}

// ---- Time: "2026-11-25T14:00" + utc_offset_seconds -> Date ------------------------------------
// The string has NO offset. new Date(str) would use the device's zone, which is wrong.
export function omTimeToDate(local, utcOffsetSeconds) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local);
  if (!m) throw new Error(`Unexpected time format: ${local}`);
  const [, y, mo, d, h = '00', mi = '00'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi) - utcOffsetSeconds * 1000);
}

// ---- Parse -----------------------------------------------------------------------------------
const toList = (json) => (Array.isArray(json) ? json : [json]); // 1 location = object, n = array

export function parseLocations(json, cities, expectUnits = {}) {
  const list = toList(json);
  if (list.length !== cities.length) throw new Error(`Expected ${cities.length} locations, got ${list.length}`);
  return list.map((loc, i) => {
    for (const [v, unit] of Object.entries(expectUnits)) {
      const got = loc.hourly_units?.[v];
      if (got !== undefined && got !== unit) throw new Error(`${v}: unit ${got}, expected ${unit}`);
    }
    const h = loc.hourly ?? {};
    const vars = Object.keys(h).filter((k) => k !== 'time');
    for (const v of vars) if (h[v].length !== h.time.length) throw new Error(`${v} misaligned with time`);
    const hourly = h.time.map((t, j) => {
      const row = { local: t, time: omTimeToDate(t, loc.utc_offset_seconds) };
      for (const v of vars) row[v] = h[v][j]; // null stays null
      return row;
    });
    return {
      city: cities[i], // map by array index; location_id is absent on the first entry
      gridLat: loc.latitude, gridLon: loc.longitude,
      timezone: loc.timezone, utcOffsetSeconds: loc.utc_offset_seconds,
      hourly, units: loc.hourly_units,
      daily: loc.daily ?? null,
    };
  });
}

// Null-safe sum: returns { value, missing } so callers can say "partial data" instead of guessing 0.
export function sumKnown(values) {
  let value = 0, missing = 0;
  for (const v of values) (v === null || v === undefined) ? missing++ : (value += v);
  return { value: Math.round(value * 1000) / 1000, missing };
}

const cToF = (c) => (c === null ? null : Math.round((c * 9 / 5 + 32) * 10) / 10);

// ---- Load (fixture or live) ---------------------------------------------------------------------
async function load(url, fixture) {
  if (LIVE) {
    const res = await fetch(url);
    const body = await res.json().catch(() => null);
    return checkBody(res.status, body);
  }
  return JSON.parse(await readFile(here(`./fixtures/${fixture}`), 'utf8'));
}

// ---- Demo -------------------------------------------------------------------------------------
const fUrl = forecastUrl(CITIES);
console.log('Forecast URL:', fUrl);
const forecast = parseLocations(await load(fUrl, 'forecast-miami-ftl-2026-11-25.json'), CITIES, {
  precipitation: 'inch', precipitation_probability: '%', weather_code: 'wmo code',
});
for (const loc of forecast) {
  console.log(`\n${loc.city.name}: grid cell ${loc.gridLat}, ${loc.gridLon} (${loc.timezone}, offset ${loc.utcOffsetSeconds}s)`);
  const first = loc.hourly[0];
  console.log(`  first hour "${first.local}" local = ${first.time.toISOString()} UTC`);
  // Hourly sum per local date vs. the API's own daily sum (sanity check of alignment + units).
  for (const [k, day] of loc.daily.time.entries()) {
    const s = sumKnown(loc.hourly.filter((r) => r.local.startsWith(day)).map((r) => r.precipitation));
    console.log(`  ${day}: hourly sum ${s.value.toFixed(3)} in (missing ${s.missing}) | daily.precipitation_sum ${loc.daily.precipitation_sum[k]} in`);
  }
}

// Nulls must stay missing, not become 0 (synthetic copy of 3 real hours with one value removed).
const synthetic = [0.114, null, 0.965];
console.log('\nNull handling (synthetic):', JSON.stringify(sumKnown(synthetic)), '-> report "partial data", not 1.079 in');

const mUrl = marineUrl([{ lat: 25.7907, lon: -80.13 }]);
console.log('\nMarine URL:', mUrl);
const [marine] = parseLocations(await load(mUrl, 'marine-miami-beach-2026-11-25.json'), [{ id: 'miami-beach', name: 'Miami Beach' }], {
  wave_height: 'm', sea_surface_temperature: '°C',
});
const noon = marine.hourly.find((r) => r.local.endsWith('T12:00'));
console.log(`Miami Beach 12:00: waves ${noon.wave_height} m, water ${noon.sea_surface_temperature} °C = ${cToF(noon.sea_surface_temperature)} °F, sea level ${noon.sea_level_height_msl} m (trend only)`);

// Error classification using the real 503 body captured on 2026-11-25.
const err503 = JSON.parse(await readFile(here('./fixtures/error-503-overloaded.json'), 'utf8'));
for (const [status, body] of [[503, err503], [400, { error: true, reason: 'Cannot initialize WeatherVariable from invalid String value tempeture_2m for key hourly' }]]) {
  try { checkBody(status, body); } catch (e) { console.log(`${e.message} -> retryable: ${e.retryable}`); }
}
console.log('\nAttribution to render: <a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>');
