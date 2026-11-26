// User profile (Supabase user_metadata only): onboarding, Google prefill, skip, edit, greeting, home city, XSS.
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mockApis, NOW } from "./mocks.mjs";
import { mockSupabase, seedSession } from "./auth-helper.mjs";

test.use({ serviceWorkers: "block" });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page, testInfo, name) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  await testInfo.attach(`axe-${name}`, { body: JSON.stringify(r.violations, null, 2), contentType: "application/json" });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), name).toEqual([]);
}
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(NOW); await mockApis(page); });
const fillSignIn = async (page) => {
  await page.getByLabel("Email").fill("ana@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct-horse");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
};

test("first sign-in -> 'Create your profile' -> save -> 'Hello, Ana' and the app opens Ana's home city", async ({ page }) => {
  const { puts } = await mockSupabase(page, { meta: {}, email: "ana@example.com" });
  await page.goto("/");
  await fillSignIn(page);
  await expect(page.getByRole("heading", { name: "Create your profile" })).toBeFocused();
  await expect(page.locator(".tabbar")).toBeHidden();
  await page.getByLabel("First name").fill("  Ana ");
  await page.getByLabel("Home city").selectOption("miami-beach");
  await page.getByLabel("Metric").check();
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.locator("#title")).toHaveText("Miami Beach");
  await expect(page.locator("#greeting")).toHaveText("Hello, Ana");
  await expect(page.locator("#flood-card")).toBeVisible();
  expect(puts.map((p) => p.data)).toEqual([{ first_name: "Ana", last_name: "", home_city_id: "miami-beach", units: "metric" }]);
  await expect(page.getByRole("link", { name: "Account", exact: true })).toContainText("A");
  expect(await page.locator("body").innerText()).not.toContain("ana@example.com");
  await page.reload(); // a fresh launch opens the same city, greeted again, with no onboarding
  await expect(page.locator("#greeting")).toHaveText("Hello, Ana");
});

test("saved home city opens straight to the outlook; an unknown home_city_id is ignored", async ({ page, context }) => {
  await seedSession(context, { meta: { first_name: "Ana", home_city_id: "miami-beach" } });
  await page.goto("/");
  await expect(page.locator("#title")).toHaveText("Miami Beach");
  await page.getByRole("link", { name: "Change City" }).click();
  await expect(page.getByRole("heading", { name: "Choose your city" })).toBeVisible();
});
test("unknown home_city_id falls back to the picker", async ({ page, context }) => {
  await seedSession(context, { meta: { first_name: "Ana", home_city_id: "atlantis" } });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose your city" })).toBeVisible();
});

test("Google user: full_name prefills the form (not saved until Save)", async ({ page, context }) => {
  const { puts } = await seedSession(context, { meta: { full_name: "María José Lopez", avatar_url: "x" } });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("María");
  await expect(page.getByLabel("Last name (optional)")).toHaveValue("José Lopez");
  expect(puts).toEqual([]);
});
test("Google user: given_name / family_name win over full_name", async ({ page, context }) => {
  await seedSession(context, { meta: { given_name: "Ana", family_name: "Ruiz", full_name: "Someone Else" } });
  await page.goto("/");
  await expect(page.getByLabel("First name")).toHaveValue("Ana");
  await expect(page.getByLabel("Last name (optional)")).toHaveValue("Ruiz");
});

test("skip for now: app greets with plain 'Hello', Settings keeps 'Finish your profile', onboarding does not repeat", async ({ page, context }) => {
  await seedSession(context, { meta: {} });
  await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
  await page.goto("/");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.locator("#greeting")).toHaveText("Hello");
  expect(await page.locator("#greeting").innerText()).not.toContain("sam@example.com");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.locator("#finish-profile")).toHaveText("Finish your profile");
  await page.reload();
  await page.getByRole("link", { name: "Outlook", exact: true }).click();
  await expect(page.locator("#greeting")).toHaveText("Hello"); // onboarding is not shown again
});

test("edit profile later updates the greeting and the Settings row", async ({ page, context }) => {
  const { puts } = await seedSession(context, { meta: { first_name: "Ana", last_name: "Ruiz" } });
  await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
  await page.goto("/#/profile");
  await expect(page.getByLabel("First name")).toHaveValue("Ana");
  await page.getByLabel("First name").fill("Anita");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.locator("#profile-status")).toHaveText("Profile saved.");
  expect(puts.at(-1).data.first_name).toBe("Anita");
  await page.getByRole("link", { name: "Outlook", exact: true }).click();
  await expect(page.locator("#greeting")).toHaveText("Hello, Anita");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.locator("#account-row")).toContainText("Profile: Anita");
  await expect(page.locator("#finish-profile")).toHaveCount(0);
});

test("empty first name: role=alert, nothing is sent", async ({ page, context }) => {
  const { puts } = await seedSession(context, { meta: { first_name: "Ana" } });
  await page.goto("/#/profile");
  await page.getByLabel("First name").fill("   ");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter your first name." })).toBeVisible();
  await expect(page.getByLabel("First name")).toBeFocused();
  expect(puts).toEqual([]);
});

test("save failure shows an alert and keeps the form", async ({ page, context }) => {
  await seedSession(context, { meta: { first_name: "Ana" }, putStatus: 500 });
  await page.goto("/#/profile");
  await page.getByRole("button", { name: "Save Profile" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Can't reach the sign-in service" })).toBeVisible();
});

test("XSS: markup in first_name is shown as text and never executes", async ({ page, context }) => {
  const evil = "<img src=x onerror=alert(1)>";
  await seedSession(context, { meta: { first_name: evil } });
  await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
  let dialog = false;
  page.on("dialog", (d) => { dialog = true; d.dismiss(); });
  await page.goto("/");
  await expect(page.locator("#greeting")).toHaveText(`Hello, ${evil}`);
  await expect(page.locator("#view img")).toHaveCount(0);
  await page.goto("/#/profile");
  await expect(page.getByLabel("First name")).toHaveValue(evil);
  await page.goto("/#/settings");
  await expect(page.locator("#account-row")).toContainText(`Profile: ${evil}`);
  await expect(page.locator("#account-row img")).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(dialog).toBe(false);
});

test("names longer than 50 characters are cut for display", async ({ page, context }) => {
  await seedSession(context, { meta: { first_name: "A".repeat(80) } });
  await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
  await page.goto("/");
  await expect(page.locator("#greeting")).toHaveText(`Hello, ${"A".repeat(50)}`);
});

for (const scheme of ["light", "dark"]) {
  test(`axe: onboarding, profile, profile error, settings with Finish your profile - ${scheme}`, async ({ page, context }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await seedSession(context, { meta: {} });
    await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Create your profile" })).toBeVisible();
    await scan(page, testInfo, "onboarding");
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter your first name." })).toBeVisible();
    await scan(page, testInfo, "onboarding-error");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.locator("#greeting")).toBeVisible();
    await scan(page, testInfo, "outlook-greeting");
    await page.goto("/#/profile");
    await scan(page, testInfo, "profile-page");
    await page.getByLabel("First name").fill("Ana");
    await page.getByRole("button", { name: "Save Profile" }).click();
    await expect(page.locator("#profile-status")).toHaveText("Profile saved.");
    await scan(page, testInfo, "profile-saved");
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await scan(page, testInfo, "settings");
  });
}
