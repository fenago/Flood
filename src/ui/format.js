// Unit and time formatting. Data arrive in US units (°F, inch, mph, ft; waves in m from the Marine API).
import { TZ } from '../shared/time.js';

export function makeUnits(system = 'us') {
  const us = system !== 'metric';
  const n = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toString();
  return {
    system: us ? 'us' : 'metric',
    rain: (inch) => (us ? `${n(inch, 1)} in` : `${n(inch * 25.4, 0)} mm`),
    temp: (f) => (us ? `${Math.round(f)} °F` : `${Math.round((f - 32) * 5 / 9)} °C`),
    speed: (mph) => (us ? `${Math.round(mph)} mph` : `${Math.round(mph * 1.609344)} km/h`),
    height: (ft) => (us ? `${n(ft, 1)} ft` : `${n(ft * 0.3048, 2)} m`),
    waves: (m) => (us ? `${n(m * 3.28084, 1)} ft` : `${n(m, 1)} m`),
    clock: (hhmm) => clock12(hhmm),
  };
}

export function clock12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const timeOf = (d) => d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
export const dateTimeOf = (d) => d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' });
export const weekdayOf = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });

/** "4 h", "25 min", "2 days" */
export function ageText(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}
