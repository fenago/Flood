// Flood Watch app entry: routing, state, data loading, rendering.
import { h, clear } from './ui/dom.js';
import { S } from './ui/strings.js';
import { makeUnits, timeOf } from './ui/format.js';
import { loadCity } from './ui/load.js';
import { renderPicker, renderAlerts, freshnessBanner, renderFloodCard, renderTides, renderBeachSummary, renderBeachPage, renderError, renderSettings } from './ui/views.js';
import { initInstall, onInstallChange, installRow, maybeAutoShowIosSheet } from './ui/install.js';
import { registerSw } from './ui/sw-register.js';
import { scoreFlood } from './scoring/flood.js';
import { scoreBeach } from './scoring/beach.js';
import { validateScoringConfig } from './scoring/config.js';
import { addDays } from './shared/time.js';
import { renderAccount, accountRow, markRecovery, markCallbackError } from './auth/ui.js';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const state = { userEmail: null, cities: [], config: null, cityId: store.get('fw-city'), units: makeUnits(store.get('fw-units') ?? 'us'), data: null, loadedAt: 0, locMessage: null, lastLead: null };
const $ = (id) => document.getElementById(id);
const city = () => state.cities.find((c) => c.id === state.cityId) ?? null;

function route() { return (location.hash.replace(/^#\/?/, '') || 'outlook').split('/')[0]; }

function setTabs(active) {
  for (const a of document.querySelectorAll('.tabbar a')) {
    if (a.dataset.tab === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

function compute() {
  const c = city(); const d = state.data;
  if (!c || !d || !d.forecast) return null;
  const alerts = d.alerts ? d.alerts.data : null; // cached alerts still act as floors (only ever raise the level)
  const tides = d.tides ? d.tides.data : null;
  const flood = [0, 1, 2].map((i) => scoreFlood({ forecast: d.forecast.data, tides, alerts, city: c, day: addDays(d.today, i), config: state.config }));
  const beach = c.coastal ? scoreBeach({ forecast: d.forecast.data, marine: d.marine?.data ?? null, alerts, day: d.today, config: state.config }) : null;
  return { flood, beach };
}

function announce(text) {
  if (text && text !== state.lastLead) { $('live').textContent = text; state.lastLead = text; }
}

function render() {
  const view = $('view');
  const r = route();
  const c = city();
  clear(view);
  if (r === 'account') {
    setTabs('settings');
    $('title').textContent = S.TAB_ACCOUNT;
    view.append(renderAccount());
    return;
  }
  if (r === 'settings') {
    setTabs('settings');
    $('title').textContent = S.SETTINGS_TITLE;
    view.append(renderSettings({ units: state.units, onUnits: (u) => { store.set('fw-units', u); state.units = makeUnits(u); render(); }, install: installRow(), account: accountRow(state.userEmail) }));
    return;
  }
  if (r === 'cities' || !c) {
    setTabs('cities');
    $('title').textContent = S.APP;
    view.append(renderPicker({ cities: state.cities, current: state.cityId, onPick: pickCity, onLocate: locate, locMessage: state.locMessage }));
    return;
  }
  $('title').textContent = c.name;
  const d = state.data;
  if (!d || d.cityId !== c.id) {
    view.append(h('p', { role: 'status', text: S.LOAD(c.name) }), h('div', { class: 'skeleton', 'aria-hidden': 'true' }));
    return;
  }
  const scored = compute();
  const banner = freshnessBanner(d);
  if (banner) view.append(banner);
  if (r === 'beach') {
    setTabs('beach');
    if (!d.forecast) view.append(renderError(refresh)); else view.append(renderBeachPage({ city: c, beach: scored.beach, units: state.units }));
  } else {
    setTabs('outlook');
    view.append(...renderAlerts(c, d));
    if (!d.forecast) view.append(renderError(refresh));
    else {
      view.append(renderFloodCard({ results: scored.flood, today: d.today, units: state.units }));
      const t = renderTides({ city: c, data: d, units: state.units }); if (t) view.append(t);
      view.append(renderBeachSummary({ city: c, beach: scored.beach }));
      announce($('flood-lead')?.textContent);
    }
  }
  if (d.oldest) view.append(h('p', { class: 'muted small', id: 'updated', text: S.UPDATED(timeOf(d.oldest)) }));
  maybeAutoShowIosSheet({ todayYmd: d.today, alertActive: Boolean(d.alerts?.data?.length) });
}

async function refresh() {
  const c = city();
  if (!c) return;
  $('topstatus').textContent = S.UPDATING;
  const data = await loadCity(c);
  data.cityId = c.id;
  data.offline = !navigator.onLine;
  if (state.cityId === c.id) { state.data = data; state.loadedAt = Date.now(); }
  $('topstatus').textContent = '';
  render();
}

function pickCity(id) {
  state.cityId = id; store.set('fw-city', id); state.data = null; state.locMessage = null;
  location.hash = '#/outlook';
  render(); refresh();
}

function locate() {
  if (!navigator.geolocation) { state.locMessage = S.PICK_LOC_DENIED; render(); return; }
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: la, longitude: lo } = pos.coords;
    const near = state.cities.reduce((best, c) => ((c.lat - la) ** 2 + (c.lon - lo) ** 2 < (best.lat - la) ** 2 + (best.lon - lo) ** 2 ? c : best));
    pickCity(near.id);
  }, () => { state.locMessage = S.PICK_LOC_DENIED; render(); $('use-location')?.setAttribute('disabled', ''); }, { maximumAge: 600000, timeout: 10000 });
}

// Account support loads lazily: only when we are returning from a sign-in/reset email link or a session is
// stored, so first-time visitors never download the auth library.
async function startAuth() {
  const p = new URLSearchParams(location.search);
  const failed = /error_description=/.test(location.hash) || p.has('error_description');
  const returning = p.has('code') || /access_token=|type=recovery/.test(location.hash);
  let stored = false;
  try { stored = Object.keys(localStorage).some((k) => k.startsWith('sb-')); } catch { /* private mode */ }
  if (failed) { markCallbackError(); location.hash = '#/account'; }
  else if (returning) location.hash = '#/account';
  if (!(failed || returning || stored)) return;
  const auth = await import('./auth/client.js');
  auth.onAuthChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { markRecovery(); if (route() !== 'account') location.hash = '#/account'; }
    const next = session?.user?.email ?? null;
    if (next !== state.userEmail) { state.userEmail = next; if (route() === 'settings') render(); }
  });
}

async function boot() {
  initInstall();
  onInstallChange(() => { if (route() === 'settings') render(); });
  registerSw();
  startAuth().catch(() => { /* account features are optional */ });
  const [cities, config] = await Promise.all([
    fetch('/data/cities.json').then((r) => r.json()),
    fetch('/config/scoring.json').then((r) => r.json()),
  ]);
  state.cities = cities.cities;
  state.config = validateScoringConfig(config);
  if (!city()) state.cityId = null;
  window.addEventListener('hashchange', render);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.loadedAt > 10 * 60 * 1000) refresh();
  });
  render();
  if (city()) refresh();
}

boot().catch(() => {
  const view = $('view');
  clear(view).append(renderError(() => location.reload()));
});
