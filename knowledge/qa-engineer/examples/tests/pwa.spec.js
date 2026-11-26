// Service worker, offline and installability checks. Chromium only: Playwright
// supports service workers only in Chromium, and CDP sessions are Chromium-only.
const { test, expect, chromium } = require('@playwright/test');
const { FORECAST, OPEN_METEO } = require('./fixtures');

test.skip(({ browserName }) => browserName !== 'chromium', 'SW + CDP need Chromium');

// Installability: use FULL Chromium (channel 'chromium') and a persistent profile.
// Verified 2026-11-26 with Playwright 1.63: the default headless shell returned []
// even for a page with no manifest (a vacuous pass), and a normal browser.newContext()
// is incognito, so it always adds errorId 'in-incognito'.
async function installabilityErrorIds(baseURL, testInfo, { dropManifest = false } = {}) {
  const ctx = await chromium.launchPersistentContext(testInfo.outputPath('profile'), { channel: 'chromium' });
  try {
    await ctx.route(OPEN_METEO, (r) => r.fulfill({ json: FORECAST }));
    if (dropManifest) {
      await ctx.route(baseURL + '/', async (r) => {
        const res = await r.fetch();
        const html = (await res.text()).replace(/<link rel="manifest"[^>]*>/, '');
        return r.fulfill({ response: res, body: html });
      });
    }
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(baseURL + '/');
    const cdp = await ctx.newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    return installabilityErrors.map((e) => e.errorId);
  } finally {
    await ctx.close();
  }
}

test('installable: CDP Page.getInstallabilityErrors is empty', async ({ baseURL }, testInfo) => {
  expect(await installabilityErrorIds(baseURL, testInfo)).toEqual([]);
});

test('negative control: no manifest link -> "no-manifest"', async ({ baseURL }, testInfo) => {
  expect(await installabilityErrorIds(baseURL, testInfo, { dropManifest: true })).toContain('no-manifest');
});

test('offline reload shows cached forecast with its age', async ({ page, context }) => {
  let offline = false;
  // context.route sees the service worker's own fetch. The handler still runs
  // while setOffline(true) is on, so it must fail the request itself.
  await context.route(OPEN_METEO, (route) =>
    offline ? route.abort('internetdisconnected') : route.fulfill({ json: FORECAST }));

  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload(); // now the SW fetches and caches the forecast
  await expect(page.locator('#rain')).toHaveText('Rain: 12.5 mm');

  offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Flood Watch' })).toBeVisible();
  await expect(page.locator('#rain')).toHaveText('Rain: 12.5 mm');
  await expect(page.getByRole('status')).toHaveText(/^Offline — forecast from \d+ min ago$/);
});
