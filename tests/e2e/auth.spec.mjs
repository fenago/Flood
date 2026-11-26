// Account flows with a mocked Supabase Auth (GoTrue) API. The real Supabase project is never called.
// Weather APIs are mocked too. WebKit is not installed here; the iPhone project is Chromium with iPhone metrics.
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mockApis, NOW } from "./mocks.mjs";
import { SB, STORAGE_KEY, mockSupabase, seedSession } from "./auth-helper.mjs";

test.use({ serviceWorkers: "block" });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page, testInfo, name) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  await testInfo.attach(`axe-${name}`, { body: JSON.stringify(r.violations, null, 2), contentType: "application/json" });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), name).toEqual([]);
}

async function openAccount(page) {
  await page.clock.setFixedTime(NOW);
  await mockApis(page);
  await page.goto("/#/account");
  await expect(page.locator("#auth-title")).toBeVisible();
}
const signin = async (page, email = "sam@example.com", pw = "correct-horse") => {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
};

test("signed in: Account is reachable from the top bar and Settings, with email and Sign Out", async ({ page, context }) => {
  await seedSession(context);
  await page.clock.setFixedTime(NOW);
  await mockApis(page);
  await page.goto("/#/settings");
  await expect(page.locator("#account-row")).toContainText("Signed in as sam@example.com");
  await page.getByRole("link", { name: "Manage Account" }).click();
  await expect(page.locator("#account-email")).toHaveText("sam@example.com");
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page.locator("#account-email")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
});

test("create account -> 'Check your email to confirm your account'", async ({ page }) => {
  const { log } = await mockSupabase(page);
  await openAccount(page);
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "at least 8 characters" })).toBeVisible();
  expect(log.filter((l) => l.includes("/signup"))).toEqual([]); // never sent
  await page.getByLabel("Password", { exact: true }).fill("longenough1");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#confirm-body")).toContainText("Check your email to confirm your account");
  await expect(page.locator("#confirm-body")).toContainText("new@example.com");
  expect(log.some((l) => l.startsWith("POST") && l.includes("/auth/v1/signup") && l.includes("redirect_to="))).toBe(true);
});

test("sign in opens the app, survives reload, and sign out returns to the gate", async ({ page }) => {
  await mockSupabase(page, { meta: { first_name: "Sam" } });
  await openAccount(page);
  await signin(page);
  await expect(page.locator("#account-btn")).toBeVisible(); // the requested #/account is now the in-app Account page
  await expect(page.locator("#account-email")).toHaveText("sam@example.com");
  await page.reload();
  await expect(page.locator("#account-email")).toHaveText("sam@example.com");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.locator("#account-row")).toContainText("Signed in as sam@example.com");
  await page.getByRole("link", { name: "Manage Account" }).click();
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  await expect(page.locator("#auth-info")).toHaveText("You are signed out.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
});

test("wrong password and unconfirmed email show clear alerts; password toggle works", async ({ page }) => {
  await mockSupabase(page, { password: "bad" });
  await openAccount(page);
  const pw = page.getByLabel("Password", { exact: true });
  await pw.fill("secret-pass");
  await expect(pw).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(pw).toHaveAttribute("type", "text");
  await signin(page, "sam@example.com", "wrong-pass1");
  await expect(page.getByRole("alert")).toContainText("don't match");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await mockApis(page); await mockSupabase(page, { password: "unconfirmed" });
  await signin(page);
  await expect(page.getByRole("alert")).toContainText("Check your email to confirm your account");
});

test("empty email is caught before any request", async ({ page }) => {
  const { log } = await mockSupabase(page);
  await openAccount(page);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter your email address.");
  expect(log).toEqual([]);
});

test("Supabase unreachable -> network error message, app still works", async ({ page }) => {
  await mockSupabase(page, { password: "down" });
  await openAccount(page);
  await signin(page);
  await expect(page.getByRole("alert")).toContainText("Can't reach the sign-in service");
});

test("forgot password sends a reset link request", async ({ page }) => {
  const { log } = await mockSupabase(page);
  await openAccount(page);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill("sam@example.com");
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.locator("#auth-info")).toContainText("a reset link is on its way");
  expect(log.some((l) => l.includes("/auth/v1/recover"))).toBe(true);
});

test("Continue with Google navigates to Supabase /auth/v1/authorize?provider=google", async ({ page, baseURL }) => {
  const { log } = await mockSupabase(page);
  await openAccount(page);
  const nav = page.waitForRequest((r) => r.url().startsWith(`${SB}/auth/v1/authorize`));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const u = new URL((await nav).url());
  expect(u.searchParams.get("provider")).toBe("google");
  expect(u.searchParams.get("redirect_to")).toBe(new URL(baseURL).origin + "/");
  expect(u.searchParams.get("code_challenge_method")).toBe("s256"); // PKCE
  expect(log.some((l) => l.includes("/authorize"))).toBe(true);
});

test("auth library missing -> \"Can't reach sign-in right now\" with Retry, and no app", async ({ page }) => {
  await page.route("**/vendor/supabase.mjs", (r) => r.abort());
  await page.clock.setFixedTime(NOW);
  await mockApis(page);
  await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
  await page.goto("/");
  await expect(page.locator("#auth-unavailable")).toHaveText("Can't reach sign-in right now. Check your connection and try again.");
  await expect(page.locator("#flood-card")).toHaveCount(0);
  await page.unroute("**/vendor/supabase.mjs");
  await mockSupabase(page);
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
});

test("Supabase blocked from the start but a valid stored session -> the app opens", async ({ page, context }) => {
  await seedSession(context);
  await context.unroute(`${SB}/**`);
  await context.route(`${SB}/**`, (r) => r.abort("blockedbyclient"));
  await page.clock.setFixedTime(NOW);
  await mockApis(page);
  await page.addInitScript(() => localStorage.setItem("fw-city", "miami-beach"));
  await page.goto("/");
  await expect(page.locator("#flood-card")).toBeVisible();
});

test("returning from an emailed/OAuth link (PKCE ?code=) goes straight into the app", async ({ page }) => {
  await page.addInitScript((k) => { localStorage.setItem(k + "-code-verifier", JSON.stringify("verifier")); localStorage.setItem("fw-city", "miami-beach"); }, STORAGE_KEY);
  await mockSupabase(page, { meta: { first_name: "Sam" } });
  await page.clock.setFixedTime(NOW);
  await mockApis(page);
  await page.goto("/?code=abc123");
  await expect(page.locator("#flood-card")).toBeVisible();
  await expect(page.locator("#greeting")).toHaveText("Hello, Sam");
});

test("password-recovery callback opens the new-password form inside the app", async ({ page }) => {
  await page.addInitScript((k) => { localStorage.setItem(k + "-code-verifier", JSON.stringify("verifier/recovery")); }, STORAGE_KEY);
  await mockSupabase(page, { meta: { first_name: "Sam" } });
  await page.clock.setFixedTime(NOW);
  await mockApis(page);
  await page.goto("/?code=abc123");
  await expect(page.getByRole("heading", { name: "Choose a New Password" })).toBeVisible();
});

for (const scheme of ["light", "dark"]) {
  test(`axe: every account screen - ${scheme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await mockSupabase(page);
    await openAccount(page);
    await scan(page, testInfo, "signin");
    await page.getByLabel("Password", { exact: true }).fill("abc");
    await page.getByRole("button", { name: "Show password" }).click();
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await scan(page, testInfo, "signin-error");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await scan(page, testInfo, "forgot");
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await scan(page, testInfo, "signup");
    await page.getByLabel("Email").fill("new@example.com");
    await page.getByLabel("Password", { exact: true }).fill("longenough1");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.locator("#confirm-body")).toBeVisible();
    await scan(page, testInfo, "confirm");
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await signin(page);
    await expect(page.locator("#account-email")).toBeVisible();
    await scan(page, testInfo, "signed-in");
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await scan(page, testInfo, "settings-with-account");
  });
  test(`axe: unavailable - ${scheme}`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.route("**/vendor/supabase.mjs", (r) => r.abort());
    await openAccount(page);
    await expect(page.locator("#auth-unavailable")).toBeVisible();
    await scan(page, testInfo, "unavailable");
  });
}

test("320 px wide: no horizontal scroll and 44 px targets on the sign-in screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await mockSupabase(page);
  await openAccount(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  for (const name of ["Sign In", "Continue with Google"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test("service worker never caches Supabase or /auth requests (Chromium)", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "SW needs Chromium");
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  await mockApis(context);
  await mockSupabase(context);
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller !== null); });
  await page.goto("/#/account");
  await signin(page);
  await expect(page.locator("#account-btn")).toBeVisible();
  const cached = await page.evaluate(async () => {
    const out = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url);
    return out;
  });
  expect(cached.filter((u) => u.includes("supabase.co") || new URL(u).pathname.startsWith("/auth"))).toEqual([]);
  expect(cached.some((u) => u.endsWith("/config/auth.json"))).toBe(true); // public config is part of the shell
  expect(cached.some((u) => u.endsWith("/vendor/supabase.mjs"))).toBe(true); // needed on every launch, so precached
  await context.close();
});
