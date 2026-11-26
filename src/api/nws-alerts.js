// National Weather Service active alerts for a point. Official alerts override our scores (fixed decision 3).
// Docs: https://www.weather.gov/documentation/services-web-api
// Browsers cannot set User-Agent; we send a plain GET (default GeoJSON, no preflight) (provisional owner decision, docs/decisions.md).
// If this request fails the UI must say "Alert status unknown", never "no alerts".
import { fetchJson } from './fetch-json.js';

export const nwsAlertsUrl = (lat, lon) => `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;

// Most serious first; unknown events sort last but are still shown.
const PRIORITY = ['Hurricane Warning', 'Storm Surge Warning', 'Flash Flood Warning', 'Flood Warning',
  'Coastal Flood Warning', 'Tropical Storm Warning', 'Hurricane Watch', 'Storm Surge Watch',
  'Flood Watch', 'Coastal Flood Watch', 'Tropical Storm Watch', 'Flood Advisory', 'Coastal Flood Advisory',
  'Rip Current Statement', 'Beach Hazards Statement', 'Coastal Flood Statement'];
const rank = (e) => { const i = PRIORITY.indexOf(e); return i === -1 ? PRIORITY.length : i; };

export function parseAlerts(geojson, now = new Date()) {
  if (!geojson || !Array.isArray(geojson.features)) throw new Error('NWS: not a FeatureCollection');
  return geojson.features
    .map((f) => f?.properties ?? {})
    .filter((p) => p.status === 'Actual' && p.messageType !== 'Cancel' && typeof p.event === 'string')
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id : null,
      event: p.event,
      headline: typeof p.headline === 'string' ? p.headline : p.event,
      severity: p.severity ?? null,
      onset: new Date(p.onset ?? p.effective ?? p.sent),
      until: new Date(p.ends ?? p.expires), // `expires` is message expiry; `ends` is the hazard end
      sender: p.senderName ?? 'National Weather Service',
    }))
    .filter((a) => !Number.isNaN(a.until.getTime()) && a.until > now)
    .sort((a, b) => rank(a.event) - rank(b.event));
}

export async function getAlerts(city, opts = {}) {
  const r = await fetchJson('NWS', nwsAlertsUrl(city.lat, city.lon), opts);
  return { ...r, data: parseAlerts(r.data, opts.now) };
}
