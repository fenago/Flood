// End-to-end check of the example PWA with plain Playwright (Chromium).
// Usage: node verify.mjs      (needs `playwright` resolvable; no external network)
// Checks: manifest served with the right type, CDP installability errors = [],
// SW controls the page, mocked Open-Meteo data renders, offline reload works and
// shows the data age, update banner appears after a new sw.js, iOS sheet logic.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const FORECAST = { hourly: { time: ['2026-11-26T00:00', '2026-11-26T01:00', '2026-11-26T02:00'],
                             precipitation: [1.2, null, 3.4] } };
let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

// Installability must be checked in FULL Chromium (channel 'chromium') with a
// persistent profile: the default headless shell returned [] even with no
// manifest, and a normal (incognito) context always reports 'in-incognito'.
async function installabilityErrors(url, { dropManifest = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fw-profile-'));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium' });
  try {
    await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: FORECAST }));
    if (dropManifest) {
      await ctx.route(url, async (r) => {
        const res = await r.fetch();
        const html = (await res.text()).replace(/<link rel="manifest"[^>]*>/, '');
        return r.fulfill({ response: res, body: html });
      });
    }
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(url);
    const cdp = await ctx.newCDPSession(page);
    return (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map((e) => e.errorId);
  } finally {
    await ctx.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

const server = await startServer({ port: 4173 });
const browser = await chromium.launch();
try {
  // ---------- Installability (CDP) with a negative control ----------
  const good = await installabilityErrors(server.url + '/');
  check(good.length === 0, 'CDP Page.getInstallabilityErrors returns no errors', JSON.stringify(good));
  const bad = await installabilityErrors(server.url + '/', { dropManifest: true });
  check(bad.includes('no-manifest'), 'negative control: page without manifest -> "no-manifest"', JSON.stringify(bad));

  // ---------- Android-like context (Pixel 7 on Chromium) ----------
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  let apiCalls = 0;
  let networkDown = false;
  // The SW's own fetch to Open-Meteo is reported to the BrowserContext and can be
  // routed there (playwright.dev/docs/service-workers). page.route would miss it.
  // NOTE: a route handler still answers while context.setOffline(true) is on
  // (observed with Playwright 1.63/Chromium), so the mock must fail on purpose.
  await context.route('https://api.open-meteo.com/**', (route) => {
    if (networkDown) return route.abort('internetdisconnected');
    apiCalls++;
    return route.fulfill({ json: FORECAST, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const page = await context.newPage();

  const manifestRes = await page.request.get(`${server.url}/manifest.webmanifest`);
  check(manifestRes.headers()['content-type'] === 'application/manifest+json',
    'manifest served as application/manifest+json');

  await page.goto(server.url + '/');
  // Wait until the SW controls the page (first load: clients.claim()).
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  check(true, 'service worker controls the page');

  const cdp = await context.newCDPSession(page);
  const manifest = await cdp.send('Page.getAppManifest');
  check(manifest.errors.length === 0 && manifest.url.endsWith('/manifest.webmanifest'),
    'CDP Page.getAppManifest parses with no errors', manifest.url);

  // Reload so the (now controlling) SW fetches and caches the forecast.
  await page.reload();
  await page.locator('#rain').filter({ hasText: '4.6 mm' }).waitFor();
  check(true, 'mocked forecast renders (null treated as 0): "Rain next 24 h: 4.6 mm"');
  check(apiCalls >= 1, 'Open-Meteo request went through context.route', `calls=${apiCalls}`);
  check(/^Updated /.test(await page.locator('#status').textContent()), 'online status shows "Updated <time>"');

  // ---------- Offline ----------
  networkDown = true;
  await context.setOffline(true);
  await page.reload();
  const offlineStatus = await page.locator('#status').textContent();
  check(await page.locator('h1').textContent() === 'Flood Watch', 'offline reload: app shell served from cache');
  check(/^Offline — forecast from \d+ min ago/.test(offlineStatus), 'offline reload: cached forecast with age label',
    offlineStatus);
  check((await page.locator('#rain').textContent()).includes('4.6 mm'), 'offline reload: cached rain value shown');
  await context.setOffline(false);
  networkDown = false;

  // ---------- Update flow ----------
  server.setSwVersion('v2');
  await page.evaluate(() => window.__swRegistration.update());
  await page.locator('#update-banner').waitFor({ state: 'visible', timeout: 15000 });
  check(true, 'new sw.js -> "Update available — Reload" banner shown');
  await Promise.all([page.waitForEvent('load'), page.click('#update-btn')]);
  const keys = await page.evaluate(() => caches.keys());
  check(keys.includes('shell-v2') && !keys.includes('shell-v1'), 'after Reload: shell-v2 active, shell-v1 deleted',
    keys.join(','));

  // ---------- Install button wiring (synthetic beforeinstallprompt) ----------
  // Headless Chromium will not fire a real beforeinstallprompt; dispatch a stand-in.
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => ({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  check(await page.locator('#install-btn').isVisible(), 'beforeinstallprompt -> Install button shown');
  await page.click('#install-btn');
  check(await page.evaluate(() => document.documentElement.dataset.installOutcome) === 'accepted' &&
        await page.locator('#install-btn').isHidden(), 'tap -> prompt() called once, button hidden');
  check(await page.locator('#ios-sheet').isHidden(), 'Android: iOS sheet not shown');
  await context.close();

  // ---------- iPhone 15 descriptor (UA/viewport only; engine is still Chromium) ----------
  const { defaultBrowserType, ...iphone } = devices['iPhone 15'];
  const ios = await browser.newContext({ ...iphone, serviceWorkers: 'block' });
  await ios.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: FORECAST }));
  const ip = await ios.newPage();
  await ip.goto(server.url + '/');
  check(await ip.locator('#ios-sheet').isVisible(), 'iPhone UA in browser tab: Add to Home Screen sheet shown');
  await ip.click('#ios-sheet-close');
  await ip.reload();
  check(await ip.locator('#ios-sheet').isHidden(), 'sheet dismissed once -> not shown again');
  await ios.close();
} catch (err) {
  failures++;
  console.error('ERROR', err);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
