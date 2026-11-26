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
import { renderAccount, accountRow, markRecovery, markCallbackError, T as AT } from './auth/ui.js';
import { renderProfile, P } from './auth/profile-ui.js';
import { parseProfile, prefillFrom } from './auth/profile.js';
import * as auth from './auth/client.js';

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const NO_PROFILE = { firstName: '', lastName: '', homeCityId: '', units: null };
const state = { mode: 'splash', session: null, userEmail: null, profile: NO_PROFILE, prefill: { firstName: '', lastName: '' }, recovery: false, entering: false, loadingFor: null, cities: [], config: null, cityId: store.get('fw-city'), units: makeUnits(store.get('fw-units') ?? 'us'), data: null, loadedAt: 0, locMessage: null, lastLead: null };
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
  if (state.mode !== 'app') return; // signed out: the gate owns the screen; no app content is ever rendered
  const view = $('view');
  const r = route();
  const c = city();
  clear(view);
  $('account-btn').toggleAttribute('aria-current', r === 'account' || r === 'profile');
  if (r === 'account') {
    setTabs('settings');
    $('title').textContent = S.TAB_ACCOUNT;
    view.append(renderAccount({ onSignedOut: () => exitApp(AT.SIGNED_OUT) }));
    return;
  }
  if (r === 'profile') {
    setTabs('settings');
    $('title').textContent = P.TITLE;
    view.append(renderProfile({ profile: state.profile, prefill: state.prefill, cities: state.cities, units: state.units.system, onSaved: applyProfile }));
    return;
  }
  if (r === 'settings') {
    setTabs('settings');
    $('title').textContent = S.SETTINGS_TITLE;
    view.append(renderSettings({ units: state.units, onUnits: (u) => { store.set('fw-units', u); state.units = makeUnits(u); render(); }, install: installRow(), account: accountRow(state.userEmail, state.profile) }));
    return;
  }
  if (r === 'cities' || !c) {
    setTabs('cities');
    $('title').textContent = S.APP;
    view.append(renderPicker({ cities: state.cities, current: state.cityId, onPick: pickCity, onLocate: locate, locMessage: state.locMessage }));
    return;
  }
  $('title').textContent = c.name;
  if (r !== 'beach') view.append(h('p', { class: 'greeting', id: 'greeting', text: state.profile.firstName ? `Hello, ${state.profile.firstName}` : 'Hello' }));
  const d = state.data;
  if (!d || d.cityId !== c.id) {
    view.append(h('p', { role: 'status', text: S.LOAD(c.name) }), h('div', { class: 'skeleton', 'aria-hidden': 'true' }));
    if (state.loadingFor !== c.id) refresh();
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
  if (state.mode !== 'app') return;
  state.loadingFor = c.id;
  $('topstatus').textContent = S.UPDATING;
  const data = await loadCity(c);
  if (state.loadingFor === c.id) state.loadingFor = null;
  if (state.mode !== 'app') return; // signed out while loading: drop the result
  data.cityId = c.id;
  data.offline = !navigator.onLine;
  if (state.cityId === c.id) { state.data = data; state.loadedAt = Date.now(); }
  $('topstatus').textContent = '';
  render();
}

function pickCity(id) {
  state.cityId = id; store.set('fw-city', id); state.data = null; state.locMessage = null;
  location.hash = '#/outlook';
  render();
}

function locate() {
  if (!navigator.geolocation) { state.locMessage = S.PICK_LOC_DENIED; render(); return; }
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: la, longitude: lo } = pos.coords;
    const near = state.cities.reduce((best, c) => ((c.lat - la) ** 2 + (c.lon - lo) ** 2 < (best.lat - la) ** 2 + (best.lon - lo) ** 2 ? c : best));
    pickCity(near.id);
  }, () => { state.locMessage = S.PICK_LOC_DENIED; render(); $('use-location')?.setAttribute('disabled', ''); }, { maximumAge: 600000, timeout: 10000 });
}


// ---- Login gate -------------------------------------------------------------------------------------------
// Nothing from the app renders (and no Open-Meteo/NOAA/NWS request is made) until a session exists.
const setMode = (m) => { state.mode = m; document.body.dataset.mode = m; };
const skipKey = (session) => `fw-profile-skipped-${session?.user?.id ?? 'x'}`;

function showSplash() {
  clear($('view')).append(h('div', { class: 'splash' }, h('p', { class: 'splash-brand', text: AT.BRAND }), h('div', { class: 'spinner', 'aria-hidden': 'true' }), h('p', { role: 'status', class: 'muted', text: AT.LOADING })));
}

function showGate(initial = 'signin', { error = '', info = '' } = {}) {
  setMode('gate');
  const view = $('view');
  clear(view).append(renderAccount({ gate: true, initial, error, info, onSignedIn: (s) => enterApp(s), onRetry: () => gateBoot() }));
  document.title = `${AT.BRAND} · ${AT.SIGNIN}`;
  view.querySelector('#auth-title')?.focus({ preventScroll: true });
}

function updateAccountBtn() {
  const src = state.profile.firstName || state.userEmail || '';
  $('account-initial').textContent = (Array.from(src)[0] ?? 'A').toUpperCase();
}

function loadStatic() {
  state.staticReady ??= Promise.all([
    fetch('/data/cities.json').then((r) => r.json()),
    fetch('/config/scoring.json').then((r) => r.json()),
  ]).then(([cities, config]) => {
    state.cities = cities.cities;
    state.config = validateScoringConfig(config);
  }).catch((e) => { state.staticReady = null; throw e; });
  return state.staticReady;
}

/** Apply a saved profile: units, home city (only when it changed), account button. No re-render: the profile page keeps its "saved" status. */
function applyProfile(p) {
  const prevHome = state.profile.homeCityId;
  state.profile = p;
  if (p.units) { store.set('fw-units', p.units); state.units = makeUnits(p.units); }
  if (p.homeCityId && p.homeCityId !== prevHome) { state.cityId = p.homeCityId; store.set('fw-city', p.homeCityId); state.data = null; state.locMessage = null; }
  updateAccountBtn();
}

let bound = false;
function bindOnce() {
  if (bound) return; bound = true;
  window.addEventListener('hashchange', render);
  window.addEventListener('online', () => { if (state.mode === 'app' && city()) refresh(); });
  document.addEventListener('visibilitychange', () => {
    if (state.mode === 'app' && city() && document.visibilityState === 'visible' && Date.now() - state.loadedAt > 10 * 60 * 1000) refresh();
  });
}

function startApp() {
  setMode('app');
  document.title = 'Flood Watch South Florida';
  updateAccountBtn();
  render();
  $('view').focus({ preventScroll: true });
}

function showOnboarding(session) {
  setMode('onboard');
  const view = $('view');
  clear(view).append(renderProfile({
    onboarding: true, profile: state.profile, prefill: state.prefill, cities: state.cities, units: state.units.system,
    onSaved: (p) => { applyProfile(p); startApp(); },
    onSkip: () => { store.set(skipKey(session), '1'); startApp(); },
  }));
  view.querySelector('#profile-title')?.focus({ preventScroll: true });
}

async function enterApp(session) {
  if (state.entering || state.mode === 'app') return;
  if (!session?.user) { showGate('signin'); return; }
  state.entering = true;
  try {
    await loadStatic();
    const meta = session.user.user_metadata;
    const ids = state.cities.map((c) => c.id);
    state.session = session;
    state.userEmail = session.user.email ?? '';
    state.profile = parseProfile(meta, ids);
    state.prefill = prefillFrom(meta);
    if (state.profile.units) { store.set('fw-units', state.profile.units); state.units = makeUnits(state.profile.units); }
    if (!city() && state.profile.homeCityId) { state.cityId = state.profile.homeCityId; store.set('fw-city', state.cityId); }
    if (!city()) state.cityId = null;
    bindOnce();
    // Land on the requested route; a sign-in callback hash (#access_token=...) is replaced by the default route.
    if (state.recovery) { state.recovery = false; history.replaceState(null, '', `${location.pathname}#/account`); }
    else if (/access_token=|error_description=|type=/.test(location.hash)) history.replaceState(null, '', `${location.pathname}#/outlook`);
    if (!state.profile.firstName && !state.recovery && !store.get(skipKey(session)) && route() !== 'account') { showOnboarding(session); return; }
    startApp();
  } catch {
    setMode('app');
    clear($('view')).append(renderError(() => location.reload()));
  } finally { state.entering = false; }
}

function exitApp(info = '') {
  state.session = null; state.userEmail = null; state.profile = NO_PROFILE; state.prefill = { firstName: '', lastName: '' };
  state.data = null; state.loadedAt = 0; state.loadingFor = null; state.lastLead = null; state.locMessage = null;
  for (const id of ['live', 'topstatus', 'toast']) $(id).textContent = '';
  clear($('view'));
  updateAccountBtn();
  showGate('signin', { info });
}

let subscribed = false;
function subscribe() {
  if (subscribed) return; subscribed = true;
  auth.onAuthChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      markRecovery(); state.recovery = true;
      if (state.mode === 'app') { location.hash = '#/account'; render(); }
    } else if (event === 'SIGNED_OUT') {
      if (state.mode === 'app' || state.mode === 'onboard') exitApp(AT.SIGNED_OUT);
    } else if (event === 'USER_UPDATED' && session && state.mode === 'app') {
      state.session = session; state.userEmail = session.user?.email ?? state.userEmail;
      state.profile = parseProfile(session.user?.user_metadata, state.cities.map((c) => c.id)); updateAccountBtn();
    } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && state.mode === 'gate') enterApp(session);
  });
}

async function gateBoot() {
  setMode('splash'); showSplash();
  const q = new URLSearchParams(location.search);
  if (/error_description=/.test(location.hash) || q.has('error_description')) markCallbackError();
  if (!(await auth.isAvailable())) { showGate('unavailable'); return; }
  subscribe();
  let session = await auth.getSession();
  if (!session && !navigator.onLine) session = auth.storedSession(); // returning user, offline: let them in
  if (session) { await enterApp(session); return; }
  if (!navigator.onLine) { showGate('unavailable'); return; }
  showGate('signin');
}

initInstall();
onInstallChange(() => { if (state.mode === 'app' && route() === 'settings') render(); });
registerSw();
gateBoot().catch(() => showGate('unavailable'));
