// The login gate: nothing from the app renders, and no weather request is made, until a session exists.
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mockApis, NOW } from "./mocks.mjs";
import { SB, mockSupabase, seedSession } from "./auth-helper.mjs";

test.use({ serviceWorkers: "block" });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const WEATHER = /open-meteo\.com|tidesandcurrents\.noaa\.gov|api\.weather\.gov/;

async function scan(page, testInfo, name) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  await testInfo.attach(`axe-${name}`, { body: JSON.stringify(r.violations, null, 2), contentType: "application/json" });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), name).toEqual([]);
}
async function setup(page, { city = true } = {}) {
  await page.clock.setFixedTime(NOW);
  const weather = [];
  page.on("request", (r) => { if (WEATHER.test(r.url())) weather.push(r.url()); });
  await mockApis(page);
  if (city) await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
  return weather;
}
const gateVisible = async (page) => {
  await expect(page.locator("#gate-brand")).toHaveText("Flood Watch");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New here? Create an account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
  for (const sel of [".tabbar", ".topbar", "#flood-card", "#beach-card", "#city-search", "#account-btn"]) await expect(page.locator(sel)).toBeHidden();
};

for (const hash of ["/", "/#/beach", "/#/settings"]) {
  test(`signed out: ${hash} shows the gate and makes zero weather requests`, async ({ page }) => {
    await mockSupabase(page);
    const weather = await setup(page);
    await page.goto(hash);
    await gateVisible(page);
    await expect(page.locator("#notice")).toBeVisible();
    await page.waitForTimeout(500);
    expect(weather).toEqual([]);
    expect(await page.locator("body").innerText()).not.toMatch(/Severe|Miami Beach|Flood risk/);
  });
}

test("sign in from #/beach lands on the beach page; sign out clears the screen", async ({ page }) => {
  await mockSupabase(page, { meta: { first_name: "Sam" } });
  const weather = await setup(page);
  await page.goto("/#/beach");
  await gateVisible(page);
  await page.getByLabel("Email").fill("sam@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct-horse");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("#beach-score")).toBeVisible();
  expect(weather.length).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Outlook", exact: true }).click();
  await expect(page.locator("#flood-card")).toBeVisible();
  const btn = page.getByRole("link", { name: "Account", exact: true });
  expect((await btn.boundingBox()).width).toBeGreaterThanOrEqual(44);
  expect((await btn.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await btn.click();
  await expect(page).toHaveURL(/#\/account$/);
  await page.getByRole("button", { name: "Sign Out" }).click();
  await gateVisible(page);
  expect(await page.locator("body").innerText()).not.toMatch(/Severe|Miami Beach/);
  await page.goBack().catch(() => {});
  await page.evaluate(() => { location.hash = "#/outlook"; });
  await gateVisible(page);
});

test("Continue with Google on the gate goes to the Supabase authorize URL (PKCE)", async ({ page, baseURL }) => {
  await mockSupabase(page);
  await setup(page);
  await page.goto("/");
  const nav = page.waitForRequest((r) => r.url().startsWith(`${SB}/auth/v1/authorize`));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const u = new URL((await nav).url());
  expect(u.searchParams.get("provider")).toBe("google");
  expect(u.searchParams.get("redirect_to")).toBe(new URL(baseURL).origin + "/");
  expect(u.searchParams.get("code_challenge_method")).toBe("s256");
});

test("no session and sign-in library unreachable: 'Can't reach sign-in right now' with Retry, still no weather requests", async ({ page }) => {
  await page.route("**/vendor/supabase.mjs", (r) => r.abort());
  const weather = await setup(page);
  await page.goto("/#/beach");
  await expect(page.locator("#auth-unavailable")).toHaveText("Can't reach sign-in right now. Check your connection and try again.");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.locator(".tabbar")).toBeHidden();
  expect(weather).toEqual([]);
});

test("offline with no session (service worker): gate with 'Can't reach sign-in right now'", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "SW needs Chromium");
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  await mockApis(context);
  await mockSupabase(context);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller !== null); });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#auth-unavailable")).toContainText("Can't reach sign-in right now");
  await expect(page.locator("#flood-card")).toHaveCount(0);
  await context.close();
});

test("offline with a stored session (service worker): the app opens, not the gate", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "SW needs Chromium");
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  const state = { offline: false };
  await mockApis(context, {}, state);
  await seedSession(context, { meta: { first_name: "Sam" } });
  await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();
  await expect(page.locator("#flood-card")).toBeVisible();
  state.offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#stale-banner")).toContainText("Offline");
  await expect(page.locator("#account-btn")).toBeVisible();
  await expect(page.locator("#auth-title")).toHaveCount(0);
  await context.close();
});

for (const scheme of ["light", "dark"]) {
  test(`axe: gate (sign in, errors, create account, forgot, unavailable) - ${scheme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await mockSupabase(page, { password: "bad" });
    await setup(page);
    await page.goto("/");
    await gateVisible(page);
    await scan(page, testInfo, "gate");
    await page.getByLabel("Email").fill("sam@example.com");
    await page.getByLabel("Password", { exact: true }).fill("wrong-pass1");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("don't match");
    await scan(page, testInfo, "gate-error");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await scan(page, testInfo, "gate-signup");
    await page.getByRole("button", { name: "Already have an account? Sign in" }).click();
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await scan(page, testInfo, "gate-forgot");
  });
  test(`axe: gate unavailable - ${scheme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.route("**/vendor/supabase.mjs", (r) => r.abort());
    await setup(page);
    await page.goto("/");
    await expect(page.locator("#auth-unavailable")).toBeVisible();
    await scan(page, testInfo, "gate-unavailable");
  });
}
