// NOAA CO-OPS tide predictions (high/low), datum MHHW, local standard/daylight time.
// Docs: https://api.tidesandcurrents.noaa.gov/api/prod/  (values `v` are strings; `t` has no offset)
import { fetchJson } from './fetch-json.js';
import { localToDate } from '../shared/time.js';

export function tideUrl(station, beginYmd, endYmd) {
  const u = new URL('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter');
  const p = { product: 'predictions', interval: 'hilo', datum: 'MHHW', time_zone: 'lst_ldt', units: 'english',
    format: 'json', station, begin_date: beginYmd.replaceAll('-', ''), end_date: endYmd.replaceAll('-', ''), application: 'FloodWatch' };
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  return u.toString();
}

export function parseTides(json) {
  if (json?.error) throw new Error(`NOAA CO-OPS: ${json.error.message ?? 'error'}`);
  if (!Array.isArray(json?.predictions)) throw new Error('NOAA CO-OPS: no predictions');
  return json.predictions.map(({ t, v, type }) => {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t)) throw new Error(`NOAA CO-OPS: bad time ${t}`);
    const ft = Number(v);
    if (!Number.isFinite(ft)) throw new Error(`NOAA CO-OPS: bad height ${v}`);
    return { local: t, time: localToDate(t), type: type === 'H' ? 'high' : 'low', ftAboveMHHW: ft };
  });
}

export async function getTides(station, beginYmd, endYmd, opts) {
  const r = await fetchJson('NOAA tides', tideUrl(station, beginYmd, endYmd), opts);
  return { ...r, data: parseTides(r.data) };
}
