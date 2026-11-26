// Open-Meteo Forecast + Marine clients (browser calls them directly: fixed decision 2).
// Free tier is non-commercial and requires the credit "Weather data by Open-Meteo.com" (CC BY 4.0).
// Docs: https://open-meteo.com/en/docs , https://open-meteo.com/en/docs/marine-weather-api
import { fetchJson } from './fetch-json.js';

export const FORECAST_HOURLY = [
  'precipitation', 'precipitation_probability', 'weather_code', 'soil_moisture_0_to_1cm',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'temperature_2m',
  'relative_humidity_2m', 'apparent_temperature', 'cloud_cover', 'uv_index',
];
export const MARINE_HOURLY = ['wave_height', 'sea_surface_temperature', 'sea_level_height_msl'];

// Unit strings exactly as Open-Meteo returns them (wind is "mp/h", soil "m³/m³", SST "°C").
const FORECAST_UNITS = { precipitation: 'inch', precipitation_probability: '%', weather_code: 'wmo code',
  temperature_2m: '°F', wind_speed_10m: 'mp/h', wind_gusts_10m: 'mp/h' };
const MARINE_UNITS = { wave_height: 'm', sea_surface_temperature: '°C' };

export function forecastUrl(city, { pastDays = 3, forecastDays = 3 } = {}) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', String(city.lat));
  u.searchParams.set('longitude', String(city.lon));
  u.searchParams.set('hourly', FORECAST_HOURLY.join(','));
  u.searchParams.set('timezone', 'America/New_York');
  u.searchParams.set('temperature_unit', 'fahrenheit');
  u.searchParams.set('wind_speed_unit', 'mph');
  u.searchParams.set('precipitation_unit', 'inch');
  u.searchParams.set('past_days', String(pastDays));
  u.searchParams.set('forecast_days', String(forecastDays));
  return u.toString();
}

export function marineUrl(city, { forecastDays = 3 } = {}) {
  const u = new URL('https://marine-api.open-meteo.com/v1/marine');
  u.searchParams.set('latitude', String(city.lat));
  u.searchParams.set('longitude', String(city.lon));
  u.searchParams.set('hourly', MARINE_HOURLY.join(','));
  u.searchParams.set('timezone', 'America/New_York');
  u.searchParams.set('cell_selection', 'sea');
  u.searchParams.set('forecast_days', String(forecastDays));
  return u.toString();
}

/** Validates one Open-Meteo location object (units, array alignment). Nulls stay null. */
export function parseOpenMeteo(json, expectUnits) {
  const loc = Array.isArray(json) ? json[0] : json;
  if (!loc || typeof loc !== 'object' || !loc.hourly || !Array.isArray(loc.hourly.time)) throw new Error('Open-Meteo: missing hourly.time');
  for (const [v, unit] of Object.entries(expectUnits)) {
    const got = loc.hourly_units?.[v];
    if (got !== undefined && got !== unit) throw new Error(`Open-Meteo: ${v} unit ${got}, expected ${unit}`);
  }
  for (const [k, arr] of Object.entries(loc.hourly)) {
    if (!Array.isArray(arr) || arr.length !== loc.hourly.time.length) throw new Error(`Open-Meteo: ${k} misaligned with time`);
  }
  return { timezone: loc.timezone, utcOffsetSeconds: loc.utc_offset_seconds, gridLat: loc.latitude, gridLon: loc.longitude, hourly: loc.hourly, units: loc.hourly_units ?? {} };
}
export const parseForecast = (json) => parseOpenMeteo(json, FORECAST_UNITS);
export const parseMarine = (json) => parseOpenMeteo(json, MARINE_UNITS);

export async function getForecast(city, opts) {
  const r = await fetchJson('Open-Meteo', forecastUrl(city), opts);
  return { ...r, data: parseForecast(r.data) };
}
export async function getMarine(city, opts) {
  const r = await fetchJson('Open-Meteo Marine', marineUrl(city), opts);
  return { ...r, data: parseMarine(r.data) };
}
