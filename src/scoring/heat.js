// SOURCED: NWS heat index, WPC algorithm (Rothfusz regression with adjustments).
// T in °F, RH in %. https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
// Open-Meteo apparent_temperature is NOT the heat index (it also folds in wind and sun), see decision 4c.
export function heatIndexF(T, RH) {
  const simple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + RH * 0.094);
  if ((simple + T) / 2 < 80) return (simple + T) / 2;
  let hi = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH - 0.00683783 * T * T
    - 0.05481717 * RH * RH + 0.00122874 * T * T * RH + 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;
  if (RH < 13 && T >= 80 && T <= 112) hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  if (RH > 85 && T >= 80 && T <= 87) hi += ((RH - 85) / 10) * ((87 - T) / 5);
  return hi;
}

// SOURCED: NWS heat index classes (Caution 80-90, Extreme Caution 90-103, Danger 103-125, Extreme Danger 125+).
export function heatClass(hi) {
  if (hi >= 125) return 'Extreme Danger';
  if (hi >= 103) return 'Danger';
  if (hi >= 90) return 'Extreme Caution';
  if (hi >= 80) return 'Caution';
  return null;
}

// SOURCED: EPA UV Index categories (UV Index guide). Returns a category key for wording in src/ui/strings.js.
export function uvCategory(uv) {
  const u = Math.round(uv);
  if (u >= 11) return 'extreme';
  if (u >= 8) return 'veryHigh';
  if (u >= 6) return 'high';
  if (u >= 3) return 'moderate';
  return 'low';
}
