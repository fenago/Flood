// Load-time validation of public/config/scoring.json. Pure: takes the parsed object, returns it or throws.
const isNumArr = (a, n) => Array.isArray(a) && (n === undefined || a.length === n) && a.every((x) => typeof x === 'number');

export function validateScoringConfig(cfg) {
  const errs = [];
  const f = cfg?.flood, b = cfg?.beach;
  if (!f || !b) throw new Error('scoring.json: flood and beach sections are required');
  if (!isNumArr(f.bands?.r24In, 4)) errs.push('flood.bands.r24In');
  if (!isNumArr(f.bands?.rmaxInPerH, 4)) errs.push('flood.bands.rmaxInPerH');
  if (!isNumArr(f.bands?.r72pastIn, 3)) errs.push('flood.bands.r72pastIn');
  for (const k of ['soilWetM3M3', 'tidePoints', 'onshoreWindMph']) if (typeof f[k] !== 'number') errs.push(`flood.${k}`);
  for (const k of ['Low', 'Elevated', 'High']) if (typeof f.levelMaxPoints?.[k] !== 'number') errs.push(`flood.levelMaxPoints.${k}`);
  for (const k of ['Severe', 'High', 'Elevated']) if (!Array.isArray(f.nwsFloors?.[k])) errs.push(`flood.nwsFloors.${k}`);
  if (!isNumArr(b.windowHours, 2)) errs.push('beach.windowHours');
  const w = b.weights ?? {};
  const sum = Object.values(w).reduce((s, x) => s + x, 0);
  if (sum !== 100) errs.push(`beach.weights must sum to 100 (got ${sum})`);
  if (!isNumArr(b.thunderCodes)) errs.push('beach.thunderCodes');
  if (!b.heavyRain || !isNumArr(b.heavyRain.codes)) errs.push('beach.heavyRain');
  if (errs.length) throw new Error(`scoring.json invalid: ${errs.join(', ')}`);
  return cfg;
}
