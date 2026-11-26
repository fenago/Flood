// Mock Open-Meteo with page.route and assert what the user sees.
const { test, expect } = require('@playwright/test');
const { FORECAST, OPEN_METEO } = require('./fixtures');

// page.route cannot see requests a service worker answers, so block the SW in
// pure UI tests (playwright.dev/docs/network). The offline spec tests the SW.
test.use({ serviceWorkers: 'block' });

test('shows rain total from the mocked forecast', async ({ page }) => {
  const seen = [];
  await page.route(OPEN_METEO, (route) => {
    seen.push(new URL(route.request().url()));
    return route.fulfill({ json: FORECAST });
  });
  await page.goto('/');
  await expect(page.locator('#rain')).toHaveText('Rain: 12.5 mm'); // null counted as 0
  await expect(page.getByRole('status')).toHaveText('Updated just now');
  await expect(page.getByText('Weather data by Open-Meteo.com')).toBeVisible();
  expect(seen[0].searchParams.get('hourly')).toBe('precipitation');
  expect(seen[0].searchParams.get('timezone')).toBe('America/New_York');
});

test('changing city requests the new coordinates', async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.fulfill({ json: FORECAST }));
  await page.goto('/');
  await expect(page.locator('#rain')).toHaveText('Rain: 12.5 mm');
  const req = page.waitForRequest((r) => r.url().includes('latitude=26.1224'));
  await page.getByLabel('City').selectOption({ label: 'Fort Lauderdale' });
  expect(new URL((await req).url()).searchParams.get('longitude')).toBe('-80.1373');
});

test('API error shows a calm alert, not a stale number', async ({ page }) => {
  await page.route(OPEN_METEO, (route) => route.fulfill({ status: 500, body: 'error' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText(/Forecast unavailable/);
  await expect(page.locator('#rain')).toBeEmpty();
});
