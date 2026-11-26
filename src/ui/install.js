// Install UI. Android/Chromium: beforeinstallprompt -> our own button -> prompt() once.
// iPhone/iPad: no install API; one-time "Add to Home Screen" sheet (Wren's spec ios-install-sheet.md):
// second visit on a different day, never dismissed in the last 30 days, no active NWS alert.
import { h } from './dom.js';
import { S } from './strings.js';

const K = { firstVisit: 'fw-first-visit-day', dismissed: 'fw-install-hint-dismissed-at' };
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
let deferred = null;
const listeners = new Set();

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}
export const onInstallChange = (f) => listeners.add(f);

/** Settings row content: Android button, iOS steps row, or "installed". */
export function installRow() {
  if (isStandalone()) return h('p', { text: S.INSTALL_DONE });
  if (deferred) {
    return h('button', { type: 'button', class: 'btn', id: 'install-btn', onclick: async () => {
      const ev = deferred; deferred = null;
      if (!ev) return;
      const { outcome } = await ev.prompt();
      document.documentElement.dataset.installOutcome = outcome;
      listeners.forEach((f) => f());
    } }, S.INSTALL_BTN);
  }
  if (isIos()) return h('button', { type: 'button', class: 'btn secondary', id: 'ios-install-row', onclick: () => openIosSheet({ fromSettings: true }) }, S.INST_SETTINGS_ROW);
  return h('p', { class: 'muted', text: 'To install, use your browser menu: Install app or Add to Home Screen.' });
}

/** Called after an outlook renders. */
export function maybeAutoShowIosSheet({ todayYmd, alertActive }) {
  if (!isIos() || isStandalone()) return;
  const first = get(K.firstVisit);
  if (!first) { set(K.firstVisit, todayYmd); return; }
  if (first === todayYmd || alertActive) return;
  const dismissed = Number(get(K.dismissed) ?? 0);
  if (dismissed && Date.now() - dismissed < 30 * 864e5) return;
  openIosSheet({ fromSettings: false });
}

export function openIosSheet({ fromSettings }) {
  if (document.getElementById('ios-sheet')) return;
  const opener = document.activeElement;
  const close = () => {
    backdrop.remove(); sheet.remove();
    document.removeEventListener('keydown', onKey);
    if (!fromSettings) {
      set(K.dismissed, String(Date.now()));
      const st = document.getElementById('toast');
      if (st) { st.textContent = S.INST_SETTINGS; setTimeout(() => { st.textContent = ''; }, 4000); }
    }
    opener?.focus?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = sheet.querySelectorAll('button, a[href]');
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  const backdrop = h('div', { class: 'sheet-backdrop', onclick: close });
  const title = h('h2', { id: 'ios-sheet-title', tabindex: '-1', text: S.INST_TITLE });
  const sheet = h('div', { class: 'sheet glass', id: 'ios-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ios-sheet-title' },
    title, h('p', { text: S.INST_WHY }),
    h('ol', {}, h('li', { text: S.INST_STEP1 }), h('li', { text: S.INST_STEP2 }), h('li', { text: S.INST_STEP3 })),
    h('p', { class: 'muted small', text: S.INST_MISSING }),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn secondary', id: 'ios-sheet-notnow', onclick: close }, S.INST_NOTNOW),
      h('button', { type: 'button', class: 'btn secondary', 'aria-label': 'Close', onclick: close }, '✕')));
  document.body.append(backdrop, sheet);
  document.addEventListener('keydown', onKey);
  title.focus();
}
