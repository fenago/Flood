// Flood prognosis (Low / Elevated / High / Severe) for one city and one local day.
// Pure function: data in, result out. Thresholds come from public/config/scoring.json and are
// HEURISTICS (docs/01 section 3), except the NWS floors, which follow official NWS products.
//
// Inputs (all already parsed by src/api):
//   forecast: Open-Meteo forecast object { hourly: { time[], precipitation[], soil_moisture_0_to_1cm[],
//             wind_speed_10m[], wind_direction_10m[] } } in inch / mph, local times, past_days=3.
//   tides:    [{ local:'YYYY-MM-DD HH:MM', type:'high'|'low', ftAboveMHHW }] or null when unavailable.
//   alerts:   [{ event, headline, onset:Date, until:Date }] already for this city's point, or null when unknown.
// Missing data is reported in `partial`, never scored as 0.
import { localToDate, addDays } from '../shared/time.js';

export const LEVELS = ['Low', 'Elevated', 'High', 'Severe'];
const band = (x, cuts) => cuts.filter((c) => x >= c).length;

// Open-Meteo precipitation is the sum of the PRECEDING hour, so local day D = D T01:00 .. D+1 T00:00.
function dayWindow(times, day, hours = 24) {
  const start = times.indexOf(`${day}T01:00`);
  const idx = [];
  for (let k = 0; k < hours; k++) idx.push(start === -1 || start + k >= times.length ? -1 : start + k);
  return idx;
}
function collect(arr, idxs) {
  const vals = idxs.map((i) => (i === -1 || !arr ? null : arr[i]));
  const known = vals.filter((v) => v !== null && v !== undefined);
  return { known, missing: vals.length - known.length, total: vals.length };
}
const inSector = (deg, [a, b]) => (a <= b ? deg >= a && deg <= b : deg >= a || deg <= b);

/** Alerts that overlap the local day [00:00, 24:00). */
export function alertsForDay(alerts, day) {
  if (!alerts) return null;
  const start = localToDate(day), end = localToDate(addDays(day, 1));
  return alerts.filter((a) => a.onset < end && a.until > start);
}

export function scoreFlood({ forecast, tides, alerts, city, day, config }) {
  const cfg = config.flood;
  const h = forecast?.hourly ?? {};
  const times = h.time ?? [];
  const reasons = [];
  const partial = [];
  let points = 0;

  const rain = collect(h.precipitation, dayWindow(times, day));
  if (rain.known.length === 0) return { day, level: null, computedLevel: null, points: null, reasons: [], partial: ['rain'], official: [], override: null };
  if (rain.missing) partial.push({ code: 'rainHours', have: rain.total - rain.missing, of: rain.total });
  const r24 = rain.known.reduce((a, b) => a + b, 0);
  const rmax = Math.max(...rain.known);
  const pR24 = band(r24, cfg.bands.r24In);
  const pRmax = band(rmax, cfg.bands.rmaxInPerH);
  points += pR24 + pRmax;
  // Decision 4d: model rain totals are estimates, and are labelled so.
  if (pR24) reasons.push({ p: pR24, code: 'rain24', inches: r24, estimate: true });
  if (pRmax) reasons.push({ p: pRmax, code: 'rainBurst', inchesPerHour: rmax, estimate: true });

  const past = collect(h.precipitation, dayWindow(times, addDays(day, -3), 72));
  if (past.missing) partial.push({ code: 'pastRainHours', have: past.total - past.missing, of: past.total });
  const r72 = past.known.reduce((a, b) => a + b, 0);
  const pR72 = band(r72, cfg.bands.r72pastIn);
  points += pR72;
  if (pR72) reasons.push({ p: pR72, code: 'pastRain', inches: r72, estimate: true });

  const soil = collect(h.soil_moisture_0_to_1cm, dayWindow(times, day));
  if (soil.known.length) {
    const smax = Math.max(...soil.known);
    if (smax >= cfg.soilWetM3M3) { points += 1; reasons.push({ p: 1, code: 'soilWet', m3m3: smax }); }
  } else partial.push({ code: 'soil' });

  if (city.coastal) {
    if (!city.tideStation) partial.push({ code: 'tideNoStation' });
    else if (!tides) partial.push({ code: 'tideMissing' });
    else {
      const highs = tides.filter((t) => t.type === 'high' && t.local.startsWith(day));
      if (highs.length === 0) partial.push({ code: 'tideMissing' });
      else {
        const top = highs.reduce((a, b) => (b.ftAboveMHHW > a.ftAboveMHHW ? b : a));
        if (top.ftAboveMHHW > 0) { points += cfg.tidePoints; reasons.push({ p: cfg.tidePoints, code: 'highTide', ft: top.ftAboveMHHW, at: top.local.slice(11) }); }
      }
    }
    if (city.onshoreFrom) {
      const sp = collect(h.wind_speed_10m, dayWindow(times, day));
      const dir = collect(h.wind_direction_10m, dayWindow(times, day));
      if (!sp.known.length || !dir.known.length) partial.push({ code: 'wind' });
      else {
        const idx = dayWindow(times, day);
        let best = 0;
        for (const i of idx) {
          if (i === -1) continue;
          const s = h.wind_speed_10m?.[i], d = h.wind_direction_10m?.[i];
          if (s != null && d != null && inSector(d, city.onshoreFrom)) best = Math.max(best, s);
        }
        if (best >= cfg.onshoreWindMph) { points += 1; reasons.push({ p: 1, code: 'onshoreWind', mph: best }); }
      }
    }
  }

  const m = cfg.levelMaxPoints;
  let level = points <= m.Low ? 'Low' : points <= m.Elevated ? 'Elevated' : points <= m.High ? 'High' : 'Severe';
  const computedLevel = level;

  // Official NWS alerts set a floor on the level (fixed decision 3).
  const active = alertsForDay(alerts, day);
  let override = null;
  if (active === null) partial.push({ code: 'alertsUnknown' });
  else {
    for (const floor of ['Severe', 'High', 'Elevated']) {
      const hit = active.find((a) => cfg.nwsFloors[floor].includes(a.event));
      if (hit && LEVELS.indexOf(level) < LEVELS.indexOf(floor)) { level = floor; override = hit.event; }
    }
  }
  reasons.sort((a, b) => b.p - a.p);
  return {
    day, level, computedLevel, points, override,
    official: (active ?? []).map((a) => ({ event: a.event, headline: a.headline, until: a.until })),
    reasons: reasons.slice(0, 3).map(({ p, ...r }) => r),
    partial,
  };
}
