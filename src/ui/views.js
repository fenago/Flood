// Screen renderers. Order on the outlook (AC3): NWS alerts first, then flood card, then beach card.
import { h } from './dom.js';
import { S, LEVEL_ICON, floodReason, partialText, beachReason, UV_TIP } from './strings.js';
import { timeOf, dateTimeOf, weekdayOf, ageText } from './format.js';
import { addDays } from '../shared/time.js';
import { STALE_AFTER_MS } from './load.js';

const whenWord = (day, today) => (day === today ? 'today' : day === addDays(today, 1) ? 'tomorrow' : `on ${weekdayOf(day)}`);
const nwsPageUrl = (city) => `https://forecast.weather.gov/MapClick.php?lat=${city.lat}&lon=${city.lon}`;

export function badge(level, small = false) {
  return h('span', { class: `badge level-${level}${small ? ' small-badge' : ''}`, 'data-level': level },
    h('span', { 'aria-hidden': 'true', text: LEVEL_ICON[level] }), h('span', { text: level }));
}

export function renderPicker({ cities, current, onPick, onLocate, locMessage }) {
  const list = h('div', { class: 'city-list', id: 'city-list' });
  const empty = h('p', { class: 'muted', role: 'status', id: 'pick-empty' });
  const draw = (q = '') => {
    list.replaceChildren();
    const qq = q.trim().toLowerCase();
    const shown = cities.filter((c) => c.name.toLowerCase().includes(qq));
    empty.textContent = shown.length ? '' : S.PICK_EMPTY(q.trim());
    for (const county of [...new Set(shown.map((c) => c.county))]) {
      list.append(h('h3', { text: `${county} County` }));
      const ul = h('ul', { class: 'city-list' });
      for (const c of shown.filter((x) => x.county === county)) {
        ul.append(h('li', {}, h('button', { type: 'button', 'aria-current': c.id === current ? 'true' : null, onclick: () => onPick(c.id) }, c.name)));
      }
      list.append(ul);
    }
  };
  const search = h('input', { type: 'search', class: 'search', id: 'city-search', autocomplete: 'off', oninput: (e) => draw(e.target.value) });
  draw();
  return h('section', { 'aria-labelledby': 'pick-title' },
    h('h2', { id: 'pick-title', text: S.PICK_TITLE }),
    h('p', { class: 'muted', text: S.PICK_HELP }),
    h('p', {}, h('button', { type: 'button', class: 'btn secondary', id: 'use-location', onclick: onLocate }, S.PICK_LOC)),
    h('p', { class: 'muted small', text: S.PICK_LOC_HELP }),
    locMessage ? h('p', { role: 'alert', text: locMessage }) : null,
    h('label', { for: 'city-search', text: S.PICK_SEARCH }), search, empty, list);
}

export function renderAlerts(city, data) {
  const nodes = [];
  const alerts = data.alerts?.data ?? [];
  if (data.alertsUnknown) {
    nodes.push(h('div', { class: 'alert-unknown', id: 'alert-unknown', role: 'status' },
      h('strong', { text: S.ALERT_UNKNOWN }), ' ', S.ALERT_UNKNOWN_DETAIL,
      ' ', h('a', { href: nwsPageUrl(city), rel: 'noopener', target: '_blank' }, 'weather.gov'),
      alerts.length ? h('div', {}, h('p', { text: S.ALERT_LAST_KNOWN(ageText(data.now - data.alerts.fetchedAt)) }),
        h('ul', {}, alerts.map((a) => h('li', { text: S.NWS_HEAD(a.event, dateTimeOf(a.until)) })))) : null));
  } else if (alerts.length) {
    const [first, ...rest] = alerts;
    nodes.push(h('section', { class: 'alert-banner', id: 'nws-banner', 'aria-labelledby': 'nws-head' },
      h('h2', { id: 'nws-head', text: S.NWS_HEAD(first.event, dateTimeOf(first.until)) }),
      rest.length ? h('ul', {}, rest.map((a) => h('li', { text: S.NWS_HEAD(a.event, dateTimeOf(a.until)) }))) : null,
      h('p', { text: S.NWS_SUB }),
      h('a', { href: nwsPageUrl(city), rel: 'noopener', target: '_blank' }, S.NWS_LINK)));
  } else {
    nodes.push(h('p', { class: 'muted small', id: 'alerts-none', text: S.ALERT_NONE(timeOf(data.alerts.fetchedAt)) }));
  }
  return nodes;
}

export function freshnessBanner(data) {
  // fromCache = the service worker answered from its cache because the network failed (offline).
  if (!data.oldest || !data.fromCache) return null;
  const age = data.now - data.oldest;
  return h('div', { class: 'banner stale', id: 'stale-banner', role: 'status',
    text: age > STALE_AFTER_MS || data.offline !== false ? S.STALE_BANNER(ageText(age)) : S.OLD_BANNER(ageText(age)) });
}

export function renderFloodCard({ results, today, units }) {
  const r = results[0];
  if (!r || !r.level) {
    return h('section', { class: 'card', id: 'flood-card', 'aria-labelledby': 'flood-title' },
      h('h2', { id: 'flood-title', text: S.FLOOD_TITLE }), h('p', { text: S.TIDES_MISSING }));
  }
  const reasons = r.reasons.map((x) => floodReason(x, units)).filter(Boolean);
  const partial = r.partial.map(partialText);
  return h('section', { class: 'card', id: 'flood-card', 'aria-labelledby': 'flood-title' },
    h('h2', { id: 'flood-title', text: S.FLOOD_TITLE }),
    badge(r.level),
    h('p', { class: 'lead', id: 'flood-lead', text: S.LEVEL_LEAD(r.level, whenWord(r.day, today)) }),
    S.HINT[r.level] ? h('p', { text: S.HINT[r.level] }) : null,
    r.override ? h('p', { id: 'flood-override', text: S.RAISED_BY_NWS(r.override) }) : null,
    reasons.length ? h('ul', { class: 'reasons' }, reasons.map((t) => h('li', { text: t }))) : h('p', { text: S.NO_SIGNAL }),
    partial.length ? h('p', { class: 'muted small', text: `${S.PARTIAL} ${partial.join(', ')}.` }) : null,
    h('p', { class: 'muted small', text: S.UNCERTAIN }),
    results.length > 1 ? h('div', {}, h('h3', { text: S.NEXT_DAYS }),
      h('ul', { class: 'days' }, results.slice(1).filter((x) => x.level).map((x) =>
        h('li', {}, h('span', { text: weekdayOf(x.day) }), badge(x.level, true))))) : null);
}

export function renderTides({ city, data, units }) {
  if (!city.coastal) return null;
  let body;
  if (!city.tideStation) body = h('p', { class: 'muted', text: S.TIDES_NONE_STATION });
  else if (!data.tides) body = h('p', { text: S.TIDES_MISSING });
  else {
    const next = data.tides.data.filter((t) => t.type === 'high' && t.time > data.now).slice(0, 2);
    body = next.length
      ? h('div', {}, h('ul', { class: 'tides' }, next.map((t) =>
        h('li', { text: `${dateTimeOf(t.time)}: ${t.ftAboveMHHW >= 0 ? '+' : '−'}${units.height(Math.abs(t.ftAboveMHHW))}` }))),
      h('p', { class: 'muted small', text: S.TIDES_NOTE }))
      : h('p', { text: S.TIDES_MISSING });
  }
  return h('section', { class: 'card', id: 'tides-card', 'aria-labelledby': 'tides-title' }, h('h2', { id: 'tides-title', text: S.TIDES_TITLE }), body);
}

export function renderBeachSummary({ city, beach }) {
  const content = !city.coastal
    ? h('p', { text: S.BEACH_INLAND(city.name) })
    : !beach || beach.score === null
      ? h('p', { text: S.ERR_TITLE })
      : h('p', {}, h('span', { class: 'score', id: 'beach-score-summary', text: String(beach.score) }), h('span', { text: ` / 100 · ${beach.label}` }));
  return h('section', { class: 'card', id: 'beach-card', 'aria-labelledby': 'beach-title' },
    h('h2', { id: 'beach-title', text: S.BEACH_TITLE }), content,
    city.coastal ? h('a', { href: '#/beach' }, S.BEACH_LINK) : null);
}

export function renderBeachPage({ city, beach, units }) {
  if (!city.coastal) return h('section', { class: 'card', id: 'beach-page' }, h('h2', { text: S.BEACH_TITLE }), h('p', { text: S.BEACH_INLAND(city.name) }));
  if (!beach || beach.score === null) return h('section', { class: 'card', id: 'beach-page', role: 'alert' }, h('h2', { text: S.ERR_TITLE }), h('p', { text: S.ERR_BODY }));
  const reasons = beach.reasons.map((r) => beachReason(r, units)).filter(Boolean);
  return h('section', { class: 'card', id: 'beach-page', 'aria-labelledby': 'beach-page-title' },
    h('h2', { id: 'beach-page-title', text: `${S.BEACH_TITLE}: ${city.name}` }),
    h('p', {}, h('span', { class: 'score', id: 'beach-score', text: String(beach.score) }), h('span', { text: ' / 100' })),
    h('p', { class: 'lead', id: 'beach-label', text: beach.label }),
    reasons.length ? h('ul', { class: 'reasons' }, reasons.map((t) => h('li', { text: t }))) : null,
    beach.uv ? h('p', { id: 'uv-tip', text: UV_TIP[beach.uv.category](Math.round(beach.uv.index)) }) : null,
    beach.heat?.class ? h('p', { text: `NWS heat index up to ${units.temp(beach.heat.index)}: ${beach.heat.class}.` }) : null,
    beach.partial.length ? h('p', { class: 'muted small', text: `${S.PARTIAL} ${beach.partial.join(', ')}.` }) : null,
    h('p', { class: 'muted small', text: S.BEACH_WINDOW }));
}

export function renderError(onRetry) {
  return h('section', { class: 'card', id: 'error-card', role: 'alert' },
    h('h2', { text: S.ERR_TITLE }), h('p', { text: S.ERR_BODY }),
    h('button', { type: 'button', class: 'btn', id: 'retry', onclick: onRetry }, S.ERR_BTN));
}

export function renderSettings({ units, onUnits, install }) {
  const radio = (value, label) => h('label', { class: 'radio' },
    h('input', { type: 'radio', name: 'units', value, checked: units.system === value, onchange: () => onUnits(value) }), label);
  return h('section', { 'aria-labelledby': 'settings-title' },
    h('h2', { id: 'settings-title', text: S.SETTINGS_TITLE }),
    h('div', { class: 'card' }, h('fieldset', {}, h('legend', { class: 'lead', text: S.UNITS_LABEL }), radio('us', S.UNITS_US), radio('metric', S.UNITS_METRIC))),
    h('div', { class: 'card', id: 'install-row' }, install));
}
