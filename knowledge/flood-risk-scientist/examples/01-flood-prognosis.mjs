// Worked example: Flood Watch flood prognosis done right, on REAL data from 2026-11-25/26
// (NWS Miami Flood Watch day). Shows:
//   - R24 / Rmax from hourly "preceding hour" precipitation, using the T01:00..T24:00 local-day window
//   - R72past from past_days=3, labelled as model-estimated rain
//   - soil, tide (NOAA, datum MHHW) and wind signals, with missing data reported, never scored as 0
//   - NWS alerts matched to the city by UGC zone and applied as a FLOOR on the level
//   - reasons with numbers, sourced vs heuristic labels
//
// Run: node 01-flood-prognosis.mjs           (fixtures; zero dependencies)
// Docs: ../docs/01..04, skill .claude/skills/flood-prognosis-model/SKILL.md
import { readFile } from 'node:fs/promises';

const fx = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

// ---- Config (mirrors public/config/scoring.json; ALL thresholds below are HEURISTICS) ----------
const CONFIG = {
  bands: { r24: [1, 2, 4, 6], rmax: [0.5, 1, 2, 3], r72past: [2, 4, 6] }, // inches, in/h, inches
  soilWetM3M3: 0.27,          // heuristic placeholder; Open-Meteo gives no saturation value (docs/04)
  tidePoints: 2,              // coastal city and predicted high tide > MHHW (NOAA v > 0 with datum=MHHW)
  onshoreWindMph: 20,
  levels: [[2, 'Low'], [5, 'Elevated'], [8, 'High'], [Infinity, 'Severe']],
  // SOURCED: official NWS products override (floor) our level. Event names as sent by api.weather.gov.
  floors: {
    Severe: ['Flash Flood Warning', 'Flood Warning', 'Coastal Flood Warning'],
    High: ['Flood Watch', 'Coastal Flood Advisory'],
  },
};
const ORDER = ['Low', 'Elevated', 'High', 'Severe'];
const band = (x, cuts) => cuts.filter((c) => x >= c).length; // count of thresholds reached

// Cities: grid index in the multi-location forecast, NWS zones (assumed — verify per city with
// api.weather.gov/points/{lat},{lon}), and a CONFIRMED tide station or null.
const CITIES = [
  { name: 'Miami', idx: 0, coastal: true, zones: ['FLZ074', 'FLZ173'], tideStation: '8723214' },
  { name: 'Fort Lauderdale', idx: 1, coastal: true, zones: ['FLZ072', 'FLZ172'], tideStation: null },
];

// ---- Helpers ----------------------------------------------------------------------------------
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// "Preceding hour" values: the local day D is the hours stamped D T01:00 ... D+1 T00:00.
function windowIdx(times, dayStart, hours) {
  const start = times.indexOf(`${dayStart}T01:00`);
  const out = [];
  for (let k = 0; k < hours; k++) out.push(start === -1 ? -1 : start + k < times.length ? start + k : -1);
  return out;
}
function collect(arr, idxs) {
  const vals = idxs.map((i) => (i === -1 ? null : arr[i]));
  const known = vals.filter((v) => v !== null && v !== undefined);
  return { known, missing: vals.length - known.length, total: vals.length };
}

function scoreDay(city, loc, day, tides, alerts) {
  const h = loc.hourly;
  const reasons = [];
  const partial = [];
  let points = 0;

  // R24 and Rmax
  const w = collect(h.precipitation, windowIdx(h.time, day, 24));
  if (w.known.length === 0) return { day, level: null, note: 'No rain data — no level shown' };
  if (w.missing) partial.push(`rain ${w.total - w.missing}/${w.total} h`);
  const r24 = w.known.reduce((a, b) => a + b, 0);
  const rmax = Math.max(...w.known);
  const pR24 = band(r24, CONFIG.bands.r24);
  const pRmax = band(rmax, CONFIG.bands.rmax);
  points += pR24 + pRmax;
  if (pR24) reasons.push({ p: pR24, text: `${r24.toFixed(1)} in of rain in 24 h (model)` });
  if (pRmax) reasons.push({ p: pRmax, text: `bursts up to ${rmax.toFixed(1)} in/h` });

  // R72past: the 72 h before the day window (model-estimated, not gauges)
  const p72 = collect(h.precipitation, windowIdx(h.time, addDays(day, -3), 72));
  if (p72.missing) partial.push(`past rain ${p72.total - p72.missing}/${p72.total} h`);
  const r72 = p72.known.reduce((a, b) => a + b, 0);
  const pR72 = band(r72, CONFIG.bands.r72past);
  points += pR72;
  if (pR72) reasons.push({ p: pR72, text: `about ${r72.toFixed(1)} in fell in the previous 3 days (estimate)` });

  // Soil (heuristic)
  const s = collect(h.soil_moisture_0_to_1cm, windowIdx(h.time, day, 24));
  if (s.known.length) {
    const smax = Math.max(...s.known);
    if (smax >= CONFIG.soilWetM3M3) { points += 1; reasons.push({ p: 1, text: `ground already wet (soil ${smax.toFixed(2)} m³/m³)` }); }
  } else partial.push('soil');

  // Tide (NOAA predictions, datum MHHW): only with a confirmed station
  if (city.coastal) {
    const highs = city.tideStation ? tides.filter((t) => t.type === 'H' && t.t.startsWith(day)) : [];
    if (highs.length === 0) partial.push(city.tideStation ? 'tide (no prediction for this day)' : 'tide (no confirmed station)');
    else {
      const top = highs.reduce((a, b) => (Number(b.v) > Number(a.v) ? b : a));
      if (Number(top.v) > 0) { points += CONFIG.tidePoints; reasons.push({ p: CONFIG.tidePoints, text: `high tide ${Number(top.v).toFixed(2)} ft above normal high water at ${top.t.slice(11)}` }); }
    }
  }
  // Onshore wind: not in this fixture -> missing, not 0
  if (city.coastal) partial.push('wind');

  let level = CONFIG.levels.find(([max]) => points <= max)[1];
  const computed = level;

  // NWS floors: alert applies if its zone matches and [onset, ends ?? expires) overlaps the local day.
  const dayStart = new Date(`${day}T00:00:00-05:00`); // EST in Nov; use a tz helper across DST
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const active = alerts.filter((a) => a.zones.some((z) => city.zones.includes(z)) && a.from < dayEnd && a.until > dayStart);
  let override = null;
  for (const floor of ['Severe', 'High']) {
    const hit = active.find((a) => CONFIG.floors[floor].includes(a.event));
    if (hit && ORDER.indexOf(level) < ORDER.indexOf(floor)) { level = floor; override = hit.event; }
  }
  reasons.sort((a, b) => b.p - a.p);
  return { day, points, computed, level, override, official: active.map((a) => a.headline), reasons: reasons.slice(0, 3).map((r) => r.text), partial };
}

// ---- Run --------------------------------------------------------------------------------------
const forecast = await fx('forecast-miami-ftl-2026-11-25.json');
const tides = (await fx('noaa-hilo-8723214-mhhw-2026-11-26.json')).predictions;
const alerts = (await fx('nws-alerts-mfl-east-coast-2026-11-25.json')).features.map(({ properties: p }) => ({
  event: p.event, headline: p.headline, zones: p.geocode.UGC,
  from: new Date(p.onset ?? p.effective), until: new Date(p.ends ?? p.expires),
}));

for (const city of CITIES) {
  const loc = forecast[city.idx];
  for (const day of ['2026-11-25', '2026-11-26']) {
    const r = scoreDay(city, loc, day, tides, alerts);
    console.log(`\n${city.name} ${day}: ${r.level}${r.override ? ` (our model: ${r.computed}, ${r.points} pts; raised by NWS ${r.override})` : ` (${r.points} pts)`}`);
    for (const hl of r.official) console.log(`  NWS: ${hl}`);
    console.log(`  Why: ${r.reasons.join('; ') || 'no significant rain, tide or soil signal'}`);
    if (r.partial.length) console.log(`  Partial data: ${r.partial.join(', ')}`);
  }
}
console.log('\nFlood Watch is not an official warning service. Follow the National Weather Service and local emergency officials.');
