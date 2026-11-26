// Public app flows on phone viewports with mocked APIs. Service workers are blocked here so page.route
// sees every request; tests/e2e/pwa.spec.mjs covers the service worker, offline and updates.
import { test, expect } from "@playwright/test";
import { mockApis, NOW, NO_ALERTS } from "./mocks.mjs";
import { seedSession } from "./auth-helper.mjs";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page, context }) => { await seedSession(context); await page.clock.setFixedTime(NOW); });

async function pickMiamiBeach(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your city" })).toBeVisible();
  await page.getByRole("button", { name: "Miami Beach" }).click();
  await expect(page.locator("#title")).toHaveText("Miami Beach");
  await expect(page.locator("#flood-card")).toBeVisible();
}

test("first run: picker -> Miami Beach outlook with NWS alerts first, flood level, reasons, tides, beach, notice, credit", async ({ page }) => {
  const seen = await mockApis(page);
  await pickMiamiBeach(page);
  const banner = page.locator("#nws-banner");
  await expect(banner).toContainText("NWS: Flood Watch until");
  await expect(banner).toContainText("Rip Current Statement");
  // DOM order: alerts, flood card, beach card (AC3)
  const order = await page.evaluate(() => ["nws-banner", "flood-card", "beach-card"].map((id) => document.getElementById(id)))
    .then(() => page.evaluate(() => {
      const a = document.getElementById("nws-banner"), f = document.getElementById("flood-card"), b = document.getElementById("beach-card");
      return [a.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING, f.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING];
    }));
  expect(order.every(Boolean)).toBe(true);
  const card = page.locator("#flood-card");
  await expect(card.locator(".badge").first()).toContainText("Severe"); // word, not only colour
  await expect(card.locator(".badge [aria-hidden='true']").first()).toBeAttached();
  await expect(page.locator("#flood-lead")).toHaveText("Flood risk today: Severe.");
  await expect(card).toContainText("model estimate");
  await expect(page.locator("#tides-card")).toContainText("Next high tides");
  await expect(page.locator("#tides-card li").first()).toContainText("+0.5 ft");
  await expect(page.locator("#beach-score-summary")).toHaveText("10");
  await expect(page.locator("#notice")).toHaveText("Flood Watch is not an official warning service. Follow the National Weather Service and local emergency officials.");
  await expect(page.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toHaveAttribute("href", "https://open-meteo.com/");
  await expect(page.locator("#updated")).toContainText("Open-Meteo, NOAA, NWS");
  // The browser called the APIs directly with the right parameters
  const f = new URL(seen.find((u) => u.includes("api.open-meteo.com")));
  expect(f.searchParams.get("latitude")).toBe("25.7907");
  expect(f.searchParams.get("timezone")).toBe("America/New_York");
  expect(seen.some((u) => u.includes("station=8723214"))).toBe(true);
  expect(seen.some((u) => u.includes("alerts/active?point=25.7907,-80.1300"))).toBe(true);
});

test("return visit opens the saved city; Change City goes back to the picker", async ({ page }) => {
  await mockApis(page);
  await pickMiamiBeach(page);
  await page.reload();
  await expect(page.locator("#title")).toHaveText("Miami Beach");
  await page.getByRole("link", { name: "Change City" }).click();
  await expect(page.getByRole("heading", { name: "Choose your city" })).toBeVisible();
  await page.getByLabel("Search cities").fill("zzz");
  await expect(page.locator("#pick-empty")).toContainText('No city matches "zzz"');
});

test("beach page: vetoed by the NWS Rip Current Statement, with UV tip", async ({ page }) => {
  await mockApis(page);
  await pickMiamiBeach(page);
  await page.getByRole("link", { name: "Beach", exact: true }).click();
  await expect(page.locator("#beach-score")).toHaveText("10");
  await expect(page.locator("#beach-label")).toHaveText("Skip it");
  await expect(page.locator("#beach-page")).toContainText("Rip Current Statement: dangerous rip currents (official)");
  await expect(page.locator("#uv-tip")).toContainText("UV 1 (Low)");
});

test("inland city has no beach score and no tide card", async ({ page }) => {
  await mockApis(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Hialeah" }).click();
  await expect(page.locator("#flood-card")).toBeVisible();
  await expect(page.locator("#beach-card")).toContainText("Hialeah is inland");
  await expect(page.locator("#tides-card")).toHaveCount(0);
});

test("settings: units toggle switches reasons to metric", async ({ page }) => {
  await mockApis(page);
  await pickMiamiBeach(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Metric (°C, mm, km/h)").check();
  await page.getByRole("link", { name: "Outlook" }).click();
  await expect(page.locator("#flood-card")).toContainText(" mm of rain");
  await page.reload();
  await expect(page.locator("#flood-card")).toContainText(" mm of rain"); // remembered
});

test("NWS failure: 'Alert status unknown — check weather.gov', never 'no alerts'", async ({ page }) => {
  await mockApis(page, { alerts: 503 });
  await pickMiamiBeach(page);
  await expect(page.locator("#alert-unknown")).toContainText("Alert status unknown — check weather.gov.");
  await expect(page.locator("#alerts-none")).toHaveCount(0);
  await expect(page.locator("#flood-card")).toContainText("NWS alerts"); // listed as partial data
});

test("no active alerts: says so with the time, flood level from the model alone", async ({ page }) => {
  await mockApis(page, { alerts: NO_ALERTS });
  await pickMiamiBeach(page);
  await expect(page.locator("#alerts-none")).toContainText("No active NWS alerts for this place as of");
  await expect(page.locator("#nws-banner")).toHaveCount(0);
});

test("forecast error: calm role=alert with a 44 px Try Again that refetches", async ({ page }) => {
  let fail = true;
  await mockApis(page, {});
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, (r) => (fail ? r.fulfill({ status: 500, body: "x" }) : r.fallback()));
  await page.goto("/");
  await page.getByRole("button", { name: "Miami Beach" }).click();
  const err = page.locator("#error-card");
  await expect(err).toHaveAttribute("role", "alert");
  await expect(err).toContainText("Can't load the forecast");
  await expect(page.locator("#notice")).toBeVisible();
  const box = await page.getByRole("button", { name: "Try Again" }).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  fail = false;
  await page.getByRole("button", { name: "Try Again" }).click();
  await expect(page.locator("#flood-card")).toBeVisible();
});

test("console is not linked anywhere in the public app", async ({ page }) => {
  await mockApis(page);
  await pickMiamiBeach(page);
  expect(await page.locator('a[href*="console"]').count()).toBe(0);
});

test("Android install button: beforeinstallprompt -> Settings shows Install App -> prompt()", async ({ page }) => {
  await mockApis(page);
  await pickMiamiBeach(page);
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true });
    e.prompt = async () => { window.__prompted = true; return { outcome: "accepted" }; };
    window.dispatchEvent(e);
  });
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Install App" }).click();
  expect(await page.evaluate(() => window.__prompted)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-install-outcome", "accepted");
  await expect(page.getByRole("button", { name: "Install App" })).toHaveCount(0);
});

test("iPhone: Add to Home Screen sheet on a second-day visit, dismissible, not shown again", async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-15", "iOS user agent only");
  await mockApis(page, { alerts: NO_ALERTS });
  await page.addInitScript(() => { if (!localStorage.getItem("fw-first-visit-day")) localStorage.setItem("fw-first-visit-day", "2026-11-20"); });
  await pickMiamiBeach(page);
  const sheet = page.getByRole("dialog", { name: "Add Flood Watch to your Home Screen" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expect(sheet).toContainText("Turn on Open as Web App, then tap Add.");
  await page.getByRole("button", { name: "Not Now" }).click();
  await expect(sheet).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#flood-card")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("iPhone: sheet does not auto-show while an NWS alert is active", async ({ page }, info) => {
  test.skip(info.project.name !== "iphone-15", "iOS user agent only");
  await mockApis(page);
  await page.addInitScript(() => localStorage.setItem("fw-first-visit-day", "2026-11-20"));
  await pickMiamiBeach(page);
  await expect(page.locator("#nws-banner")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("reflow at 320 px: no horizontal scroll", async ({ page }) => {
  await mockApis(page);
  await page.setViewportSize({ width: 320, height: 640 });
  await pickMiamiBeach(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
