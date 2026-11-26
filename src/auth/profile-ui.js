// Profile form (page and first-sign-in onboarding). Text only via textContent (dom.js h()).
import { h } from '../ui/dom.js';
import * as auth from './client.js';
import { NAME_MAX } from './profile.js';

export const P = {
  TITLE: 'Profile',
  CREATE: 'Create your profile',
  INTRO: 'Tell us your name and home city. Flood Watch uses them to greet you and open to your city. You can change them any time.',
  FIRST: 'First name', LAST: 'Last name (optional)', HOME: 'Home city', NO_HOME: 'No home city', UNITS: 'Units',
  UNITS_US: 'US (°F, in, mph)', UNITS_METRIC: 'Metric (°C, mm, km/h)',
  SAVE: 'Save Profile', SAVING: 'Saving…', SKIP: 'Skip for now', SAVED: 'Profile saved.',
  ERR: {
    first_name_required: 'Enter your first name.',
    first_name_too_long: `Your first name can be at most ${NAME_MAX} characters.`,
    last_name_too_long: `Your last name can be at most ${NAME_MAX} characters.`,
    invalid_city: 'Choose a city from the list.',
    invalid_units: 'Choose US or Metric units.',
    network: "Can't reach the sign-in service. Check your connection and try again.",
    unavailable: "Can't reach sign-in right now. Check your connection and try again.",
    no_session: 'Your session has ended. Please sign in again.',
    unknown: 'Something went wrong. Please try again.',
  },
};
const FIELD_FOR = { first_name_required: 'pf-first', first_name_too_long: 'pf-first', last_name_too_long: 'pf-last', invalid_city: 'pf-home' };

/**
 * { profile, prefill, cities, units, onboarding, onSaved(profile), onSkip() }
 * `profile` = saved values, `prefill` = suggested names used only when no first name is saved yet.
 */
export function renderProfile({ profile, prefill, cities, units, onboarding = false, onSaved, onSkip }) {
  const saved = Boolean(profile.firstName);
  const root = h('section', { class: onboarding ? 'auth profile gate' : 'auth profile', 'aria-labelledby': 'profile-title' });
  const heading = h(onboarding ? 'h1' : 'h2', { id: 'profile-title', tabindex: '-1', text: onboarding ? P.CREATE : P.TITLE });
  const err = h('p', { class: 'auth-error', id: 'profile-error', role: 'alert' });
  const status = h('p', { class: 'auth-info', id: 'profile-status', role: 'status' });

  const input = (id, label, value, autocomplete) => {
    const el = h('input', { class: 'field', id, name: id, type: 'text', autocomplete, maxlength: NAME_MAX, autocapitalize: 'words', spellcheck: 'false' });
    el.value = value;
    return { el, wrap: h('div', { class: 'field-row' }, h('label', { for: id, text: label }), el) };
  };
  const first = input('pf-first', P.FIRST, saved ? profile.firstName : (prefill?.firstName ?? ''), 'given-name');
  first.el.setAttribute('aria-required', 'true');
  const last = input('pf-last', P.LAST, saved ? profile.lastName : (prefill?.lastName ?? ''), 'family-name');

  const select = h('select', { class: 'field', id: 'pf-home', name: 'pf-home' }, h('option', { value: '', text: P.NO_HOME }),
    ...cities.map((c) => h('option', { value: c.id, text: c.name })));
  select.value = profile.homeCityId || '';
  const unitNow = profile.units ?? units;
  const radio = (value, label) => h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'pf-units', value, checked: unitNow === value }), label);
  const units_ = h('fieldset', {}, h('legend', { class: 'lead', text: P.UNITS }), radio('us', P.UNITS_US), radio('metric', P.UNITS_METRIC));

  const submit = h('button', { type: 'submit', class: 'btn', id: 'profile-save' }, P.SAVE);
  const form = h('form', { class: 'card auth-form', id: 'profile-form', novalidate: true },
    first.wrap, last.wrap, h('div', { class: 'field-row' }, h('label', { for: 'pf-home', text: P.HOME }), select), units_, submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = ''; status.textContent = '';
    submit.disabled = true; submit.textContent = P.SAVING; root.setAttribute('aria-busy', 'true');
    const r = await auth.saveProfile({
      firstName: first.el.value, lastName: last.el.value, homeCityId: select.value,
      units: form.querySelector('input[name="pf-units"]:checked')?.value ?? 'us',
    }, cities.map((c) => c.id));
    submit.disabled = false; submit.textContent = P.SAVE; root.setAttribute('aria-busy', 'false');
    if (!r.ok) {
      err.textContent = P.ERR[r.code] ?? P.ERR.unknown;
      root.querySelector(`#${FIELD_FOR[r.code] ?? 'pf-first'}`)?.focus();
      return;
    }
    status.textContent = P.SAVED;
    onSaved(r.profile);
  });

  root.append(heading, onboarding ? h('p', { class: 'muted', text: P.INTRO }) : null, err, status, form,
    onboarding ? h('button', { type: 'button', class: 'link-btn', id: 'profile-skip', onclick: () => onSkip() }, P.SKIP) : null);
  return root;
}
