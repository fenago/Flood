// Flood Watch example page script: registers the SW, shows the update banner,
// loads one forecast and always states how old the data is.
import { initInstallUi } from './install.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast' +
  '?latitude=25.7617&longitude=-80.1918&hourly=precipitation' +
  '&timezone=America%2FNew_York&forecast_days=1';

const statusEl = document.getElementById('status');
const rainEl = document.getElementById('rain');

initInstallUi();
registerServiceWorker();
loadForecast();

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

  // A worker already waiting (e.g. installed on a previous visit).
  if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);

  reg.addEventListener('updatefound', () => {
    const next = reg.installing;
    next?.addEventListener('statechange', () => {
      // "installed" + an existing controller = an update is waiting, not a first install.
      if (next.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(next);
    });
  });

  // When the new worker takes control, reload once so page and SW versions match.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !window.__updateRequested) return;
    reloaded = true;
    location.reload();
  });
  window.__swRegistration = reg; // handy for tests; harmless in production
}

function showUpdateBanner(worker) {
  const banner = document.getElementById('update-banner');
  banner.hidden = false;
  document.getElementById('update-btn').onclick = () => {
    window.__updateRequested = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  };
}

async function loadForecast() {
  try {
    const res = await fetch(FORECAST_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // The SW adds X-Fetched-At only when it serves a cached copy (network failed).
    const cachedAt = res.headers.get('X-Fetched-At');
    const total = (data.hourly?.precipitation ?? [])
      .reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0); // Open-Meteo may send null
    rainEl.textContent = `Rain next 24 h: ${total.toFixed(1)} mm`;
    statusEl.textContent = describeAge(cachedAt ? new Date(cachedAt) : new Date(), Boolean(cachedAt));
  } catch {
    statusEl.textContent = 'Forecast unavailable offline. Check NWS for current alerts.';
  }
}

function describeAge(fetchedAt, fromCache) {
  const mins = Math.max(0, Math.round((Date.now() - fetchedAt.getTime()) / 60000));
  const time = fetchedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (fromCache || mins >= 180) {
    const age = mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`;
    return `Offline — forecast from ${age} ago. Check NWS for current alerts.`;
  }
  return `Updated ${time}`;
}
