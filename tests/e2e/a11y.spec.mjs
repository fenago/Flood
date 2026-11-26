// axe-core WCAG 2.0/2.1/2.2 A+AA on every public page state, light and dark. Automated checks catch only
// part of WCAG; VoiceOver/TalkBack passes stay manual.
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mockApis, NOW, NO_ALERTS } from "./mocks.mjs";

test.use({ serviceWorkers: "block" });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page, testInfo, name) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  await testInfo.attach(`axe-${name}`, { body: JSON.stringify(r.violations, null, 2), contentType: "application/json" });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), name).toEqual([]);
}

for (const scheme of ["light", "dark"]) {
  test(`axe: picker, outlook (alerts), beach, settings, no-alerts, alerts-unknown, error - ${scheme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.clock.setFixedTime(NOW);
    await mockApis(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Choose your city" })).toBeVisible();
    await scan(page, testInfo, "picker");
    await page.getByRole("button", { name: "Miami Beach" }).click();
    await expect(page.locator("#nws-banner")).toBeVisible();
    await scan(page, testInfo, "outlook");
    await page.getByRole("link", { name: "Beach", exact: true }).click();
    await expect(page.locator("#beach-score")).toBeVisible();
    await scan(page, testInfo, "beach");
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await scan(page, testInfo, "settings");
  });

  test(`axe: alert states and error - ${scheme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.clock.setFixedTime(NOW);
    await mockApis(page, { alerts: 503 });
    await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
    await page.goto("/#/outlook");
    await expect(page.locator("#alert-unknown")).toBeVisible();
    await scan(page, testInfo, "alerts-unknown");
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockApis(page, { forecast: 500, alerts: NO_ALERTS });
    await page.reload();
    await expect(page.locator("#error-card")).toBeVisible();
    await scan(page, testInfo, "error");
  });
}

test("negative control: axe catches a removed label", async ({ page }) => {
  await mockApis(page);
  await page.goto("/");
  await expect(page.getByLabel("Search cities")).toBeVisible();
  await page.evaluate(() => document.querySelector('label[for="city-search"]').remove());
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => v.id)).toContain("label");
});
