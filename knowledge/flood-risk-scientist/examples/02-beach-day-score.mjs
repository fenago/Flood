// Worked example: beach-day score (0-100) for Miami Beach on 2026-11-25 from REAL captures.
// Shows: 10:00-16:00 local window, hard vetoes first (NWS rip current, thunder codes, warnings,
// gusts, waves) with a cap at 10, then weighted comfort factors; the NWS heat index computed from
// temperature + humidity (Open-Meteo apparent_temperature is NOT the heat index); SST °C -> °F;
// EPA UV tip; top-2 reasons. A "what if" run without the NWS alert shows the veto's effect.
//
// Run: node 02-beach-day-score.mjs     (fixtures; zero dependencies)
// Docs: ../docs/03-beach-hazards-rip-heat-uv.md, ../docs/04-open-meteo-fields-for-scoring.md
import { readFile } from 'node:fs/promises';

const fx = async (n) => JSON.parse(await readFile(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));

// ---- SOURCED: NWS heat index (WPC algorithm), T in °F, RH in % --------------------------------
export function heatIndexF(T, RH) {
  const simple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + RH * 0.094);
  if ((simple + T) / 2 < 80) return (simple + T) / 2;
  let hi = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH - 0.00683783 * T * T
    - 0.05481717 * RH * RH + 0.00122874 * T * T * RH + 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;
  if (RH < 13 && T >= 80 && T <= 112) hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  if (RH > 85 && T >= 80 && T <= 87) hi += ((RH - 85) / 10) * ((87 - T) / 5);
  return hi;
}
const heatClass = (hi) => (hi >= 125 ? 'Extreme Danger' : hi >= 103 ? 'Danger' : hi >= 90 ? 'Extreme Caution' : hi >= 80 ? 'Caution' : 'none');

// ---- SOURCED: EPA UV categories (UV Index guide PDF) ---------------------------------------------
function uvTip(uv) {
  const u = Math.round(uv);
  if (u >= 11) return `UV ${u} (Extreme): skin can burn in minutes; white sand reflects UV. Avoid sun 11 a.m.-4 p.m.`;
  if (u >= 8) return `UV ${u} (Very High): unprotected skin can burn quickly. Try to avoid sun 11 a.m.-4 p.m.`;
  if (u >= 6) return `UV ${u} (High): reduce time in the sun 11 a.m.-4 p.m.; hat, sunglasses, sunscreen.`;
  if (u >= 3) return `UV ${u} (Moderate): sunscreen and shade near midday.`;
  return `UV ${u} (Low): sunglasses; sunscreen if you burn easily.`;
}

// ---- HEURISTIC comfort curves (skill beach-day-score; anchors marked * are our own fill-ins) ----
const lerp = (x, x0, y0, x1, y1) => (x <= x0 ? y0 : x >= x1 ? y1 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0));
const F = {
  rain: { w: 25, f: (pop) => lerp(pop, 20, 1, 60, 0) },                                   // max % in window
  heat: { w: 15, f: (hi) => (hi < 78 ? lerp(hi, 65, 0, 78, 1) /* *cool side */ : lerp(hi, 90, 1, 103, 0)) },
  wind: { w: 15, f: (mph) => (mph < 5 ? 0.8 /* *calm */ : lerp(mph, 12, 1, 25, 0)) },     // mean speed
  waves: { w: 15, f: (m) => lerp(m, 0.6, 1, 1.5, 0) },                                     // max height
  water: { w: 10, f: (f) => (f <= 77 ? lerp(f, 70, 0, 77, 1) : lerp(f, 86, 1, 92, 0.5) /* *hot side */) },
  sky: { w: 10, f: (c) => (c < 10 ? 0.9 /* * */ : lerp(c, 50, 1, 100, 0.3)) },            // mean cloud %
  uv: { w: 10, f: (uv) => lerp(uv, 7, 1, 11, 0.3) },                                      // max UV
};
const THUNDER = new Set([95, 96, 97, 99]); // 97 "Heavy thunderstorm" is in the Open-Meteo table; skill lists 95/96/99
const BEACH_ALERTS = ['Rip Current Statement', 'Beach Hazards Statement'];
const WARNING_RE = /(Hurricane|Tropical Storm|Storm Surge|Flash Flood|Flood|Coastal Flood) Warning/;

export function beachScore({ wx, marine, alerts, day, zone }) {
  const inWin = (t) => t.startsWith(day) && +t.slice(11, 13) >= 10 && +t.slice(11, 13) <= 16; // 10:00..16:00
  const pick = (src, v) => src.hourly.time.map((t, i) => (inWin(t) ? src.hourly[v][i] : undefined)).filter((x) => x !== undefined);
  const known = (a) => a.filter((x) => x !== null);
  const max = (a) => Math.max(...known(a)), mean = (a) => known(a).reduce((s, x) => s + x, 0) / known(a).length;

  const temp = pick(wx, 'temperature_2m'), rh = pick(wx, 'relative_humidity_2m');
  const his = temp.map((t, i) => (t === null || rh[i] === null ? null : heatIndexF(t, rh[i])));
  const v = {
    rain: max(pick(wx, 'precipitation_probability')),
    heat: max(his),
    feelsOM: max(pick(wx, 'apparent_temperature')),
    wind: mean(pick(wx, 'wind_speed_10m')),
    gust: max(pick(wx, 'wind_gusts_10m')),
    waves: max(pick(marine, 'wave_height')),
    water: mean(pick(marine, 'sea_surface_temperature')) * 9 / 5 + 32, // marine SST is °C
    sky: mean(pick(wx, 'cloud_cover')),
    uv: max(pick(wx, 'uv_index')),
    codes: known(pick(wx, 'weather_code')),
  };

  // Vetoes
  const winStart = new Date(`${day}T10:00:00-05:00`), winEnd = new Date(`${day}T16:00:00-05:00`);
  const here = alerts.filter((a) => a.zones.includes(zone) && a.from < winEnd && a.until > winStart);
  const vetoes = [];
  for (const a of here) if (BEACH_ALERTS.includes(a.event)) vetoes.push(`NWS ${a.event}: life-threatening rip currents (official)`);
  for (const a of here) if (WARNING_RE.test(a.event)) vetoes.push(`NWS ${a.event} in effect (official)`);
  if (v.codes.some((c) => THUNDER.has(c))) vetoes.push('Thunderstorms expected (lightning risk)');
  if (v.gust >= 30) vetoes.push(`Gusts to ${v.gust.toFixed(0)} mph`);
  if (v.waves >= 2) vetoes.push(`Waves ${v.waves.toFixed(1)} m`);

  // Weighted comfort
  const parts = Object.entries(F).map(([k, { w, f }]) => ({ k, w, got: w * f(v[k]) }));
  let score = Math.round(parts.reduce((s, p) => s + p.got, 0));
  const raw = score;
  if (vetoes.length) score = Math.min(score, 10);
  const label = score >= 80 ? 'Great beach day' : score >= 60 ? 'Good' : score >= 40 ? 'Meh' : 'Skip it';
  const text = {
    rain: `rain chance up to ${v.rain}%`, heat: `heat index ${v.heat.toFixed(0)} °F`, wind: `wind ${v.wind.toFixed(0)} mph`,
    waves: `waves up to ${v.waves.toFixed(1)} m`, water: `water ${v.water.toFixed(0)} °F`, sky: `${v.sky.toFixed(0)}% cloud`, uv: `UV ${v.uv.toFixed(0)}`,
  };
  const losses = parts.filter((p) => p.w - p.got >= 1).sort((a, b) => (b.w - b.got) - (a.w - a.got)).map((p) => text[p.k]);
  return { score, raw, label, vetoes, reasons: [...vetoes, ...losses].slice(0, 2), v, uvTip: uvTip(v.uv), heatClass: heatClass(v.heat), parts };
}

// ---- Run on the real 2026-11-25 Miami Beach data ---------------------------------------------
const wx = await fx('forecast-miami-beach-beachday-2026-11-25.json');
const marine = await fx('marine-miami-beach-2026-11-25.json');
const alerts = (await fx('nws-alerts-mfl-east-coast-2026-11-25.json')).features.map(({ properties: p }) => ({
  event: p.event, zones: p.geocode.UGC, from: new Date(p.onset ?? p.effective), until: new Date(p.ends ?? p.expires),
}));
const args = { wx, marine, day: '2026-11-25', zone: 'FLZ173' }; // Coastal Miami-Dade

for (const [title, al] of [['Real (with NWS alerts)', alerts], ['What-if: same weather, no NWS alerts', []]]) {
  const r = beachScore({ ...args, alerts: al });
  console.log(`\n${title}: ${r.score}/100 "${r.label}"${r.vetoes.length ? ` (capped from ${r.raw} by veto)` : ''}`);
  console.log(`  Top reasons: ${r.reasons.join('; ')}`);
  console.log(`  Factors: ${r.parts.map((p) => `${p.k} ${p.got.toFixed(1)}/${p.w}`).join(', ')}`);
}
const r = beachScore({ ...args, alerts });
console.log(`\nHeat: NWS heat index max ${r.v.heat.toFixed(1)} °F (${r.heatClass}) vs Open-Meteo apparent_temperature max ${r.v.feelsOM} °F`);
console.log(`Water ${r.v.water.toFixed(1)} °F (from °C), gusts max ${r.v.gust} mph in window (36 mph at 08:00 is outside the window)`);
console.log(r.uvTip);
// Heat index spot checks against the WPC algorithm (hand-computed reference values).
for (const [T, RH] of [[90, 70], [96, 65], [72, 96]]) console.log(`  HI(${T} °F, ${RH}%) = ${heatIndexF(T, RH).toFixed(1)} °F -> ${heatClass(heatIndexF(T, RH))}`);
