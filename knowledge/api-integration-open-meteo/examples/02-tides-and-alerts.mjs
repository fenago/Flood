// Worked example: parse NOAA CO-OPS high/low tide predictions (datum MHHW) and NWS active alerts
// into clean objects, DST-safe, with the "is this alert still in force?" rule done right.
//
// Fixtures (default):  node 02-tides-and-alerts.mjs
// Live (needs network): node 02-tides-and-alerts.mjs --live
//
// Zero dependencies. Docs: ../docs/04-noaa-coops-tides.md, ../docs/05-nws-alerts-api.md
import { readFile } from 'node:fs/promises';

const LIVE = process.argv.includes('--live');
const here = (p) => new URL(p, import.meta.url);
const TZ = 'America/New_York';

// ---- Wall time in a named zone -> Date (handles DST without libraries) ------------------------
function zoneOffsetMs(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - date.getTime();
}
export function wallTimeToDate(y, mo, d, h, mi, timeZone = TZ) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - zoneOffsetMs(new Date(guess), timeZone);
  t = guess - zoneOffsetMs(new Date(t), timeZone); // second pass settles DST edges
  return new Date(t);
}

// ---- NOAA CO-OPS ------------------------------------------------------------------------------
export function tideUrl(station, beginYmd, endYmd) {
  const u = new URL('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter');
  Object.entries({
    product: 'predictions', interval: 'hilo', datum: 'MHHW', time_zone: 'lst_ldt', units: 'english',
    format: 'json', station, begin_date: beginYmd, end_date: endYmd, application: 'FloodWatch',
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

export function parseTides(json) {
  if (json?.error) throw new Error(`NOAA CO-OPS: ${json.error.message}`); // shape: {error:{message}}
  return (json.predictions ?? []).map(({ t, v, type }) => {
    const [, y, mo, d, h, mi] = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(t).map(Number);
    const ft = Number(v); // v is a string
    return { local: t, time: wallTimeToDate(y, mo, d, h, mi), type: type === 'H' ? 'high' : 'low', ftAboveMHHW: ft };
  });
}

// ---- NWS alerts -------------------------------------------------------------------------------
export const nwsAlertsUrl = (lat, lon) => `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;

// Order to show alerts in (most serious first). Unknown events go last but are still shown.
const PRIORITY = ['Hurricane Warning', 'Storm Surge Warning', 'Flash Flood Warning', 'Flood Warning',
  'Coastal Flood Warning', 'Tropical Storm Warning', 'Hurricane Watch', 'Storm Surge Watch',
  'Flood Watch', 'Coastal Flood Watch', 'Tropical Storm Watch', 'Flood Advisory', 'Coastal Flood Advisory',
  'Rip Current Statement', 'Beach Hazards Statement', 'Coastal Flood Statement'];
const rank = (e) => { const i = PRIORITY.indexOf(e); return i === -1 ? PRIORITY.length : i; };

export function parseAlerts(geojson, now) {
  return (geojson.features ?? [])
    .map((f) => f.properties)
    .filter((p) => p.status === 'Actual' && p.messageType !== 'Cancel')
    .map((p) => ({
      event: p.event,
      headline: p.headline, // show verbatim
      nwsHeadline: p.parameters?.NWSheadline?.[0] ?? null,
      severity: p.severity, certainty: p.certainty, urgency: p.urgency,
      onset: new Date(p.onset ?? p.effective),
      until: new Date(p.ends ?? p.expires), // hazard end; `expires` is only the message expiry
      expires: new Date(p.expires),
      zones: p.geocode?.UGC ?? [],
      sender: p.senderName,
      url: `https://api.weather.gov/alerts/${p.id}`,
    }))
    .filter((a) => a.until > now)
    .sort((a, b) => rank(a.event) - rank(b.event));
}

async function load(url, fixture, headers) {
  if (LIVE) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return res.json();
  }
  return JSON.parse(await readFile(here(`./fixtures/${fixture}`), 'utf8'));
}

// ---- Demo -------------------------------------------------------------------------------------
const fmt = (d) => d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

const tUrl = tideUrl('8723214', '20261126', '20261127');
console.log('Tide URL:', tUrl);
const tides = parseTides(await load(tUrl, 'noaa-hilo-8723214-mhhw-2026-11-26.json'));
const NWS_MINOR_FT_ABOVE_MHHW = 1.30; // Virginia Key floodlevels.json: 13.68 - MHHW 12.38 (see docs/04)
for (const t of tides.filter((x) => x.type === 'high')) {
  console.log(`  High ${fmt(t.time)}: ${t.ftAboveMHHW.toFixed(2)} ft above MHHW (${(NWS_MINOR_FT_ABOVE_MHHW - t.ftAboveMHHW).toFixed(2)} ft below NWS minor flood level)`);
}

// DST sanity: the same local noon is 16:00Z in summer (EDT) and 17:00Z in winter (EST).
console.log('  DST sanity: 2026-07-01 12:00 local =', wallTimeToDate(2026, 7, 1, 12, 0).toISOString(), '| 2026-12-01 12:00 local =', wallTimeToDate(2026, 12, 1, 12, 0).toISOString());

const aUrl = nwsAlertsUrl(25.7907, -80.13);
console.log('\nAlerts URL:', aUrl);
// In a Function proxy, send these; a browser cannot set User-Agent (see docs/05).
const headers = { Accept: 'application/geo+json', 'User-Agent': 'FloodWatch (flood-watch app)' };
const raw = await load(aUrl, 'nws-alerts-point-miami-beach-2026-11-25.json', headers);
// Fixed "now" so the fixture is deterministic: 2026-11-25 20:30 EST. Live mode uses the real clock.
const now = LIVE ? new Date() : new Date('2026-11-25T20:30:00-05:00');
for (const a of parseAlerts(raw, now)) {
  console.log(`  [${a.event}] in force until ${fmt(a.until)} (message expires ${fmt(a.expires)}) severity=${a.severity}`);
  console.log(`      ${a.headline}`);
}
const later = new Date('2026-11-26T12:00:00-05:00');
console.log(`\nAt ${fmt(later)} still active:`, parseAlerts(raw, later).map((a) => a.event));
