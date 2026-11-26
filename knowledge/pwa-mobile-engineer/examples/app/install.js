// Install UI for Flood Watch.
// - Chromium (Android/desktop): capture beforeinstallprompt, show our own button,
//   call prompt() once on tap (MDN "Trigger installation from your PWA").
// - iPhone/iPad: no beforeinstallprompt exists; show a one-time, dismissible
//   "Share -> Add to Home Screen" sheet, only when running in a browser tab.
const SHEET_KEY = 'fw-ios-sheet-dismissed';

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true; // iOS Safari legacy flag
}

export function isIos() {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports a Mac UA; touch points tell it apart from a real Mac.
  return /iPhone|iPad|iPod/.test(ua) ||
         (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, v) { try { localStorage.setItem(key, v); } catch { /* private mode */ } }

export function initInstallUi() {
  const button = document.getElementById('install-btn');
  const sheet = document.getElementById('ios-sheet');
  let deferred = null;

  if (isStandalone()) return; // already installed: show nothing

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();         // suppress the browser mini-infobar
    deferred = event;               // keep it for the user's tap
    button.hidden = false;
  });

  button.addEventListener('click', async () => {
    if (!deferred) return;
    const { outcome } = await deferred.prompt(); // 'accepted' | 'dismissed'
    document.documentElement.dataset.installOutcome = outcome;
    deferred = null;                // the event can be used only once
    button.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    button.hidden = true;
  });

  if (isIos() && !safeGet(SHEET_KEY)) {
    sheet.hidden = false;
    document.getElementById('ios-sheet-close').addEventListener('click', () => {
      sheet.hidden = true;
      safeSet(SHEET_KEY, '1'); // never nag again
    });
  }
}
