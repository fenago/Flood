// Profile = Supabase Auth user metadata only (first_name, last_name, home_city_id, units). Pure functions, no I/O.
// Metadata is untrusted display data: it is trimmed, length-capped and checked against known values here, and
// every consumer renders it with textContent only.
export const NAME_MAX = 50;
export const UNIT_VALUES = ['us', 'metric'];

// Control characters and whitespace runs collapse to one space; then trim.
const clean = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim() : '');
export const cleanName = (v) => clean(v).slice(0, NAME_MAX).trim();

/** Saved profile from user_metadata. Unknown or invalid values become '' / null. */
export function parseProfile(meta, cityIds = []) {
  const m = meta && typeof meta === 'object' ? meta : {};
  const home = typeof m.home_city_id === 'string' ? m.home_city_id : '';
  return {
    firstName: cleanName(m.first_name),
    lastName: cleanName(m.last_name),
    homeCityId: Array.isArray(cityIds) && cityIds.includes(home) ? home : '',
    units: UNIT_VALUES.includes(m.units) ? m.units : null,
  };
}

/** Suggested names for the form when the user has not saved a first name (Google: given_name/family_name, else full_name/name). Never saved automatically. */
export function prefillFrom(meta) {
  const m = meta && typeof meta === 'object' ? meta : {};
  let first = cleanName(m.given_name);
  let last = cleanName(m.family_name);
  if (!first) {
    const parts = clean(m.full_name || m.name).split(' ').filter(Boolean);
    first = cleanName(parts[0] ?? '');
    if (!last) last = cleanName(parts.slice(1).join(' '));
  }
  return { firstName: first, lastName: last };
}

/** { ok:true, value } or { ok:false, code, field }. */
export function validateProfile(fields, cityIds = []) {
  const f = fields ?? {};
  const first = clean(f.firstName), last = clean(f.lastName);
  const home = typeof f.homeCityId === 'string' ? f.homeCityId : '';
  const units = f.units ?? 'us';
  if (!first) return { ok: false, code: 'first_name_required', field: 'firstName' };
  if (first.length > NAME_MAX) return { ok: false, code: 'first_name_too_long', field: 'firstName' };
  if (last.length > NAME_MAX) return { ok: false, code: 'last_name_too_long', field: 'lastName' };
  if (home && !(Array.isArray(cityIds) && cityIds.includes(home))) return { ok: false, code: 'invalid_city', field: 'homeCityId' };
  if (!UNIT_VALUES.includes(units)) return { ok: false, code: 'invalid_units', field: 'units' };
  return { ok: true, value: { firstName: first, lastName: last, homeCityId: home, units } };
}
