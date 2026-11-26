// Automated accessibility scan with @axe-core/playwright (WCAG A/AA tags).
// Automated tools catch only part of WCAG; manual VoiceOver/TalkBack checks still apply.
const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { FORECAST, OPEN_METEO } = require('./fixtures');

test.use({ serviceWorkers: 'block' });

test('outlook screen has no WCAG 2.x A/AA violations', async ({ page }, testInfo) => {
  await page.route(OPEN_METEO, (r) => r.fulfill({ json: FORECAST }));
  await page.goto('/');
  await expect(page.locator('#rain')).toHaveText('Rain: 12.5 mm'); // scan the loaded state
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await testInfo.attach('axe-results', { body: JSON.stringify(results.violations, null, 2),
                                         contentType: 'application/json' });
  expect(results.violations).toEqual([]);
});
