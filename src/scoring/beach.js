// Beach-day score (0-100) for one local day, 10:00-16:00 window. Pure function.
// Stage 1: hard vetoes cap the score (NWS rip current / beach hazards, warnings, thunder incl. WMO 97,
// strong gusts, big waves). Stage 2: weighted comfort factors. Decision 4b: heavy rain most of the window
// caps the score in the "Skip it" band. Decision 4c: heat uses the NWS heat index from temp + RH.
// SOURCED: NWS rip-current products, NWS heat index classes, EPA UV categories. Everything else is a HEURISTIC.
import { localToDate } from '../shared/time.js';
import { heatIndexF, heatClass, uvCategory } from './heat.js';

const lerp = (x, x0, y0, x1, y1) => (x <= x0 ? y0 : x >= x1 ? y1 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0));
// Comfort curves (HEURISTIC; docs/01 section 4.2). Each returns 0..1.
const CURVES = {
  rain: (pop) => lerp(pop, 20, 1, 60, 0),
  heat: (hi) => (hi < 78 ? lerp(hi, 65, 0, 78, 1) : lerp(hi, 90, 1, 103, 0)),
  wind: (mph) => (mph < 5 ? 0.8 : lerp(mph, 12, 1, 25, 0)),
  waves: (m) => lerp(m, 0.6, 1, 1.5, 0),
  water: (f) => (f <= 77 ? lerp(f, 70, 0, 77, 1) : lerp(f, 86, 1, 92, 0.5)),
  sky: (c) => (c < 10 ? 0.9 : lerp(c, 50, 1, 100, 0.3)),
  uv: (uv) => lerp(uv, 7, 1, 11, 0.3),
};

export function scoreBeach({ forecast, marine, alerts, day, config }) {
  const cfg = config.beach;
  const [h0, h1] = cfg.windowHours;
  const inWin = (t) => t.startsWith(day) && +t.slice(11, 13) >= h0 && +t.slice(11, 13) <= h1;
  const pick = (src, v) => {
    const h = src?.hourly;
    if (!h?.time || !h[v]) return [];
    return h.time.map((t, i) => (inWin(t) ? h[v][i] : undefined)).filter((x) => x !== undefined);
  };
  const known = (a) => a.filter((x) => x !== null && x !== undefined);
  const max = (a) => (known(a).length ? Math.max(...known(a)) : null);
  const mean = (a) => (known(a).length ? known(a).reduce((s, x) => s + x, 0) / known(a).length : null);

  const temp = pick(forecast, 'temperature_2m'), rh = pick(forecast, 'relative_humidity_2m');
  const his = temp.map((t, i) => (t == null || rh[i] == null ? null : heatIndexF(t, rh[i])));
  const sst = mean(pick(marine, 'sea_surface_temperature'));
  const v = {
    rain: max(pick(forecast, 'precipitation_probability')),
    heat: max(his),
    wind: mean(pick(forecast, 'wind_speed_10m')),
    gust: max(pick(forecast, 'wind_gusts_10m')),
    waves: max(pick(marine, 'wave_height')),
    water: sst === null ? null : sst * 9 / 5 + 32, // Marine API returns °C
    sky: mean(pick(forecast, 'cloud_cover')),
    uv: max(pick(forecast, 'uv_index')),
  };
  const codes = known(pick(forecast, 'weather_code'));
  if (v.rain === null && v.heat === null && v.wind === null) {
    return { day, score: null, raw: null, label: null, vetoes: [], reasons: [], partial: ['weather'], values: v };
  }

  const vetoes = [];
  const partial = [];
  if (alerts === null) partial.push('alerts');
  else {
    const winStart = localToDate(`${day}T${String(h0).padStart(2, '0')}:00`);
    const winEnd = localToDate(`${day}T${String(h1).padStart(2, '0')}:00`);
    const warnRe = new RegExp(cfg.vetoWarningPattern);
    for (const a of alerts.filter((x) => x.onset < winEnd && x.until > winStart)) {
      if (cfg.vetoAlerts.includes(a.event)) vetoes.push({ code: 'nwsBeach', event: a.event });
      else if (warnRe.test(a.event)) vetoes.push({ code: 'nwsWarning', event: a.event });
    }
  }
  const thunder = codes.find((c) => cfg.thunderCodes.includes(c));
  if (thunder !== undefined) vetoes.push({ code: 'thunder', wmo: thunder });
  if (v.gust !== null && v.gust >= cfg.gustVetoMph) vetoes.push({ code: 'gusts', mph: v.gust });
  if (v.waves !== null && v.waves >= cfg.waveVetoM) vetoes.push({ code: 'waves', m: v.waves });

  // Weighted comfort. A missing factor gets half credit and is reported as partial data.
  const parts = Object.entries(cfg.weights).map(([k, w]) => {
    if (v[k] === null || v[k] === undefined) { partial.push(k); return { k, w, got: w * 0.5 }; }
    return { k, w, got: w * CURVES[k](v[k]) };
  });
  const raw = Math.round(parts.reduce((s, p) => s + p.got, 0));
  let score = raw;
  const heavyHours = codes.filter((c) => cfg.heavyRain.codes.includes(c)).length;
  const heavyRain = heavyHours >= cfg.heavyRain.minHours;
  if (heavyRain) score = Math.min(score, cfg.heavyRain.cap);
  if (vetoes.length) score = Math.min(score, cfg.vetoCap);
  const label = cfg.labels.find(([min]) => score >= min)[1];

  const losses = parts
    .filter((p) => !partial.includes(p.k) && p.w - p.got >= 1)
    .sort((a, b) => (b.w - b.got) - (a.w - a.got))
    .map((p) => ({ code: p.k, value: v[p.k] }));
  const lead = [...vetoes];
  if (heavyRain) lead.push({ code: 'heavyRain', hours: heavyHours });
  return {
    day, score, raw, label, vetoes, heavyRain,
    reasons: [...lead, ...losses].slice(0, 2),
    uv: v.uv === null ? null : { index: v.uv, category: uvCategory(v.uv) },
    heat: v.heat === null ? null : { index: v.heat, class: heatClass(v.heat) },
    partial, values: v,
  };
}
