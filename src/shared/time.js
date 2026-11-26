// Time helpers shared by src/api and src/scoring (no DOM, no fetch).
// South Florida uses America/New_York; all wall times are converted DST-safely with Intl.
export const TZ = 'America/New_York';

function zoneOffsetMs(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - date.getTime();
}

/** Wall-clock time in a named zone -> Date. Two passes settle DST edges. */
export function wallTimeToDate(y, mo, d, h = 0, mi = 0, timeZone = TZ) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - zoneOffsetMs(new Date(guess), timeZone);
  t = guess - zoneOffsetMs(new Date(t), timeZone);
  return new Date(t);
}

/** "2026-11-25" or "2026-11-25T14:00" or "2026-11-25 14:00" (local wall time) -> Date. */
export function localToDate(s, timeZone = TZ) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(s);
  if (!m) throw new Error(`Unexpected local time format: ${s}`);
  return wallTimeToDate(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), timeZone);
}

/** Local calendar date (YYYY-MM-DD) of an instant in the zone. */
export function localYmd(date, timeZone = TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function addDays(ymd, n) {
  return new Date(Date.parse(`${ymd}T00:00Z`) + n * 864e5).toISOString().slice(0, 10);
}
