// Service worker, offline, update banner and installability. Chromium only (Playwright supports service
// workers and CDP only in Chromium). context.route sees the service worker's own fetches.
import { test, expect, chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { cp, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { mockApis, NOW } from "./mocks.mjs";

test.skip(({ browserName }) => browserName !== "chromium", "SW + CDP need Chromium");

async function openCity(page) {
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => localStorage.setItem("fw-city", "miami-beach"));
  await page.reload(); // now the SW fetches (and caches) the forecast
  await expect(page.locator("#flood-card")).toBeVisible();
}

test("offline: reload shows the cached outlook, an offline banner with its age, and the notice", async ({ page, context }) => {
  await page.clock.setFixedTime(NOW);
  const state = { offline: false };
  await mockApis(context, {}, state);
  await openCity(page);
  state.offline = true;
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#title")).toHaveText("Miami Beach");
  await expect(page.locator("#stale-banner")).toContainText(/^Offline\. This forecast is from \d+ (min|h|days) ago\. Check NWS for current alerts\.$/);
  await expect(page.locator("#flood-card")).toContainText("Severe");
  await expect(page.locator("#notice")).toBeVisible();
});

test("offline with nothing cached: error card, never a made-up outlook", async ({ page, context }) => {
  const state = { offline: false };
  await mockApis(context, {}, state);
  await page.goto("/");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  state.offline = true;
  await context.setOffline(true);
  await page.getByRole("button", { name: "Fort Lauderdale" }).click();
  await expect(page.locator("#error-card")).toContainText("Can't load the forecast");
  await expect(page.locator("#alert-unknown")).toContainText("Alert status unknown");
});

// Simulates a real deploy: a private copy of dist/ is served, then its sw.js changes on disk.
async function privateServer(dir) {
  const server = http.createServer(async (req, res) => {
    let p = new URL(req.url, "http://x").pathname;
    if (p.endsWith("/")) p += "index.html";
    try {
      const body = await readFile(join(dir, p));
      const type = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json" }[extname(p)] ?? "application/octet-stream";
      res.writeHead(200, { "content-type": type, "cache-control": "no-cache" }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://localhost:${server.address().port}`, close: () => { server.closeAllConnections(); server.close(); } };
}

test("update banner: a new build's sw.js shows 'Reload', which activates the new worker and drops the old shell cache", async ({ page, context }, testInfo) => {
  const dir = testInfo.outputPath("site");
  await cp(fileURLToPath(new URL("../../dist", import.meta.url)), dir, { recursive: true });
  const srv = await privateServer(dir);
  try {
    await mockApis(context);
    await page.goto(srv.url + "/");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const before = await page.evaluate(() => caches.keys());
    const sw = await readFile(join(dir, "sw.js"), "utf8");
    await writeFile(join(dir, "sw.js"), sw.replace(/const VERSION = "[0-9a-f]+"/, 'const VERSION = "e2e-next-version"'));
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect(page.locator("#update-banner")).toContainText("A new version of Flood Watch is ready.");
    const reloaded = page.waitForEvent("load"); // the page reloads itself once the new worker takes control
    await page.getByRole("button", { name: "Reload" }).click();
    await reloaded;
    const shells = async () => { try { return (await page.evaluate(() => caches.keys())).filter((k) => k.startsWith("shell-")); } catch { return []; } };
    await expect.poll(shells).toEqual(["shell-e2e-next-version"]);
    await expect(page.locator("#update-banner")).toHaveCount(0);
    expect(before.some((k) => k.startsWith("shell-") && k !== "shell-e2e-next-version")).toBe(true);
  } finally { srv.close(); }
});

test("service worker never intercepts /api or /console", async () => {
  const sw = readFileSync(new URL("../../dist/sw.js", import.meta.url), "utf8");
  expect(sw).toMatch(/pathname\.startsWith\('\/api\/'\) \|\| url\.pathname\.startsWith\('\/console'\)\)\) return;/);
  expect(sw).not.toContain("__FW_");
  expect(sw).toContain('"/index.html"');
});

async function installabilityErrors(baseURL, testInfo, { dropManifest = false } = {}) {
  const ctx = await chromium.launchPersistentContext(testInfo.outputPath("profile"), { channel: "chromium" });
  try {
    await mockApis(ctx);
    if (dropManifest) {
      await ctx.route(`${baseURL}/`, async (r) => {
        const res = await r.fetch();
        return r.fulfill({ response: res, body: (await res.text()).replace(/<link rel="manifest"[^>]*>/, "") });
      });
    }
    const page = ctx.pages()[0] || (await ctx.newPage());
    await page.goto(`${baseURL}/`);
    const cdp = await ctx.newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    return installabilityErrors.map((e) => e.errorId);
  } finally { await ctx.close(); }
}

test("installable in Chromium (CDP), with a negative control", async ({ baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7", "run once");
  expect(await installabilityErrors(baseURL, testInfo)).toEqual([]);
  expect(await installabilityErrors(baseURL, testInfo, { dropManifest: true })).toContain("no-manifest");
});

test("manifest is served as application/manifest+json with 192/512 and maskable icons", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.headers()["content-type"]).toContain("application/manifest+json");
  const m = await res.json();
  expect(m.display).toBe("standalone");
  expect(m.icons.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
});
