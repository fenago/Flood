// Flood Watch example Playwright config: one Android and one iPhone project.
// Run against a deploy preview with BASE_URL=https://deploy-preview-12--site.netlify.app
// (then the local webServer is skipped).
const { defineConfig, devices } = require('@playwright/test');

const PORT = 4321;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// iPhone 15 normally runs on WebKit. Where WebKit is not installed (this repo's
// agent container), FW_IPHONE_ON_CHROMIUM=1 keeps the iPhone viewport/UA/touch
// but uses Chromium. That is NOT a Safari test; real-device checks still apply.
const iphoneEngine = process.env.FW_IPHONE_ON_CHROMIUM ? { browserName: 'chromium' } : {};

module.exports = defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,            // per test (Playwright default)
  expect: { timeout: 5_000 }, // web-first assertions retry up to this (default)
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',  // CLI --trace off overrides this
  },
  projects: [
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },                  // Chromium
    { name: 'iphone-15', use: { ...devices['iPhone 15'], ...iphoneEngine } }, // WebKit
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: `node serve.js ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
