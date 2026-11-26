// Loads every source for one city in parallel. Each source can fail on its own (partial state ST4).
import { getForecast, getMarine } from '../api/open-meteo.js';
import { getTides } from '../api/noaa-tides.js';
import { getAlerts } from '../api/nws-alerts.js';
import { localYmd, addDays } from '../shared/time.js';

export const ALERT_MAX_AGE_MS = 30 * 60 * 1000; // data-freshness-offline skill
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export async function loadCity(city, { now = new Date(), fetchImpl } = {}) {
  const today = localYmd(now);
  const opts = { fetchImpl };
  const jobs = {
    forecast: getForecast(city, opts),
    marine: city.coastal ? getMarine(city, opts) : Promise.resolve(null),
    tides: city.tideStation ? getTides(city.tideStation, today, addDays(today, 2), opts) : Promise.resolve(null),
    alerts: getAlerts(city, { ...opts, now }),
  };
  const keys = Object.keys(jobs);
  const settled = await Promise.allSettled(Object.values(jobs));
  const out = { today, now, errors: {} };
  settled.forEach((s, i) => {
    const k = keys[i];
    if (s.status === 'fulfilled') out[k] = s.value;
    else { out[k] = null; out.errors[k] = s.reason; }
  });
  const stamps = keys.map((k) => out[k]).filter(Boolean);
  out.fromCache = stamps.some((r) => r.fromCache);
  out.oldest = stamps.length ? new Date(Math.min(...stamps.map((r) => r.fetchedAt.getTime()))) : null;
  // Alerts: unknown if the request failed or the cached copy is older than 30 min (never "no alerts").
  out.alertsUnknown = !out.alerts || now - out.alerts.fetchedAt > ALERT_MAX_AGE_MS;
  return out;
}
