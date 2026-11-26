// Function test harness: real handlers + mocked Blobs, Claude and GitHub (function-testing-mocks skill).
import { setDeps } from "../../netlify/lib/deps.mjs";
import { _resetAuthCache } from "../../netlify/lib/auth.mjs";
import { memoryBlobs } from "./memory-blobs.mjs";
import { mockClaude } from "./mock-claude.mjs";
import { mockGitHub } from "./mock-github.mjs";
import { mockSupabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./mock-supabase.mjs";

export const ORIGIN = "https://flood.test";
export const ADMIN_EMAIL = "owner@example.com";

export async function setup({ claudeScript = [], files = { "public/config/scoring.json": "{}\n", "docs/decisions.md": "# Decisions\n" }, now, envOverrides = {} } = {}) {
  const blobs = memoryBlobs();
  const claude = mockClaude(claudeScript);
  const gh = mockGitHub(files);
  const clock = { t: now ?? new Date("2026-11-26T15:00:00Z") };
  const supabase = mockSupabase({ now: () => new Date(clock.t) });
  _resetAuthCache();
  const envVals = {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    CONSOLE_ADMIN_EMAILS: ` Someone@Other.test , ${ADMIN_EMAIL.toUpperCase()} `, // trimmed + lowercased by the server
    ANTHROPIC_API_KEY: "test-dummy-key",
    GITHUB_TOKEN: "test-dummy-token",
    GITHUB_REPO: `${gh.owner}/${gh.repo}`,
    GITHUB_BRANCH: "main",
    DAILY_TOKEN_BUDGET: "100000",
    CONTEXT: "production",
    ...envOverrides,
  };
  for (const [k, v] of Object.entries(envVals)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  // One fetch for both mocks, routed by host: Supabase Auth calls never reach the GitHub mock's log.
  const fetch = (url, init) => (new URL(url).origin === SUPABASE_URL ? supabase.fetch(url, init) : gh.fetch(url, init));
  setDeps({ getStore: blobs.getStore, anthropic: () => claude.client, fetch, githubApiBase: "https://api.github.test", now: () => new Date(clock.t), authTimeoutMs: 50 });
  return { blobs, claude, gh, supabase, clock, advance: (ms) => { clock.t = new Date(clock.t.getTime() + ms); } };
}

export function makeRequest(path, { method = "GET", body, token, authorization, origin = ORIGIN, secFetchSite, headers = {} } = {}) {
  const h = new Headers(headers);
  if (body !== undefined) h.set("content-type", "application/json");
  if (token) h.set("authorization", `Bearer ${token}`);
  if (authorization !== undefined) h.set("authorization", authorization);
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

/** "Sign in" with the mock Supabase and return { token } (admin by default; pass options to mockSupabase.issue). */
export function login(env, opts = {}) {
  return { token: env.supabase.issue({ email: ADMIN_EMAIL, ...opts }) };
}
