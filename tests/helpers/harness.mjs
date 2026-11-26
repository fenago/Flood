// Function test harness: real handlers + mocked Blobs, Claude and GitHub (function-testing-mocks skill).
import { setDeps } from "../../netlify/lib/deps.mjs";
import { hashPassword } from "../../netlify/lib/session.mjs";
import { memoryBlobs } from "./memory-blobs.mjs";
import { mockClaude } from "./mock-claude.mjs";
import { mockGitHub } from "./mock-github.mjs";

export const ORIGIN = "https://flood.test";
export const PASSWORD = "correct horse battery staple";
let cachedHash = null;

export async function setup({ claudeScript = [], files = { "public/config/scoring.json": "{}\n", "docs/decisions.md": "# Decisions\n" }, now, envOverrides = {} } = {}) {
  cachedHash ??= await hashPassword(PASSWORD, { N: 2 ** 15, r: 8, p: 1, keylen: 32, saltBytes: 16 }); // lower N only to keep tests fast
  const blobs = memoryBlobs();
  const claude = mockClaude(claudeScript);
  const gh = mockGitHub(files);
  const clock = { t: now ?? new Date("2026-11-26T15:00:00Z") };
  const envVals = {
    SESSION_SECRET: "test-session-secret-0123456789-abcdefghijklmnop",
    CONSOLE_PASSWORD_HASH: cachedHash,
    ANTHROPIC_API_KEY: "test-dummy-key",
    GITHUB_TOKEN: "test-dummy-token",
    GITHUB_REPO: `${gh.owner}/${gh.repo}`,
    GITHUB_BRANCH: "main",
    DAILY_TOKEN_BUDGET: "100000",
    CONTEXT: "production",
    ...envOverrides,
  };
  for (const [k, v] of Object.entries(envVals)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  setDeps({ getStore: blobs.getStore, anthropic: () => claude.client, fetch: gh.fetch, githubApiBase: "https://api.github.test", now: () => new Date(clock.t) });
  return { blobs, claude, gh, clock, advance: (ms) => { clock.t = new Date(clock.t.getTime() + ms); } };
}

export function makeRequest(path, { method = "GET", body, cookie, csrf, origin = ORIGIN, secFetchSite, headers = {} } = {}) {
  const h = new Headers(headers);
  if (body !== undefined) h.set("content-type", "application/json");
  if (cookie) h.set("cookie", cookie);
  if (csrf) h.set("x-csrf-token", csrf);
  if (origin && method !== "GET") h.set("origin", origin);
  if (secFetchSite) h.set("sec-fetch-site", secFetchSite);
  return new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
}
export const ctx = (ip = "203.0.113.7", context = "production") => ({ ip, requestId: "req-test", deploy: { context } });

export async function call(handler, path, opts = {}, context = ctx()) {
  const res = await handler(makeRequest(path, opts), context);
  const ct = res.headers.get("content-type") ?? "";
  const body = ct.includes("json") ? await res.json() : await res.text();
  return { status: res.status, headers: res.headers, body };
}

export function parseSse(text) {
  return text.split("\n\n").filter((b) => b.startsWith("event:")).map((b) => {
    const [ev, data] = b.split("\n");
    return { event: ev.slice(7), data: JSON.parse(data.slice(6)) };
  });
}

/** Log in and return { cookie, csrf }. */
export async function login(loginHandler, context = ctx()) {
  const r = await call(loginHandler, "/api/auth-login", { method: "POST", body: { password: PASSWORD } }, context);
  if (r.status !== 200) throw new Error(`login failed ${r.status} ${JSON.stringify(r.body)}`);
  const cookie = r.headers.get("set-cookie").split(";")[0];
  return { cookie, csrf: r.body.csrfToken, setCookie: r.headers.get("set-cookie") };
}
