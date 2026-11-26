// Registers the service worker and shows "Update available" when a new worker is waiting.
// The page asks the worker to skipWaiting only after the user taps Reload.
import { h } from './dom.js';
import { S } from './strings.js';

export function registerSw() {
  if (!('serviceWorker' in navigator)) return;
  // Reload only when the user asked for the update. On the very first install, clients.claim() also fires
  // controllerchange; reloading then would interrupt a first-time visitor for no reason.
  let userAsked = false;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (userAsked && !reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    const offer = (worker) => {
      const slot = document.getElementById('update-slot');
      if (!slot || slot.firstChild) return;
      slot.append(h('div', { class: 'banner update glass', id: 'update-banner', role: 'status' },
        h('span', { text: S.UPDATE_READY }),
        h('button', { type: 'button', class: 'btn', id: 'update-reload', onclick: () => { userAsked = true; worker.postMessage({ type: 'SKIP_WAITING' }); } }, S.UPDATE_BTN)));
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => { /* offline support unavailable; app still works online */ });
}
