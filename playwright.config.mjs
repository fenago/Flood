// Public-app e2e on phone viewports with mocked APIs (no real Open-Meteo/NOAA/NWS calls).
// WebKit is not installed in this container: the iPhone project uses the iPhone 15 viewport/UA/touch on
// Chromium. That is NOT a Safari test; real-iPhone checks remain manual (docs/deploy.md).
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const iphoneEngine = process.env.FW_IPHONE_ON_WEBKIT ? {} : { browserName: "chromium", defaultBrowserType: "chromium" };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
  projects: [
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "iphone-15", use: { ...devices["iPhone 15"], ...iphoneEngine } },
  ],
  webServer: process.env.BASE_URL ? undefined : { command: `node scripts/serve.mjs dist ${PORT}`, url: BASE_URL, reuseExistingServer: !process.env.CI },
});
