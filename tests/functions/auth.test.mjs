// Function tests: Supabase bearer-token auth for /api/session and the admin-only console endpoints.
// Supabase is mocked (tests/helpers/mock-supabase.mjs); no real Supabase, Claude or GitHub call is made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, call, login, ctx, ADMIN_EMAIL } from "../helpers/harness.mjs";
import session, { config as sessionConfig } from "../../netlify/functions/session.mjs";
import agents from "../../netlify/functions/agents.mjs";
import { config as chatConfig } from "../../netlify/functions/agent-chat.mjs";
import { readdir } from "node:fs/promises";
import { SUPABASE_PUBLISHABLE_KEY } from "../helpers/mock-supabase.mjs";

const assertApiHeaders = (h) => {
  assert.equal(h.get("cache-control"), "no-store");
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(h.get("access-control-allow-origin"), null);
  assert.equal(h.get("set-cookie"), null);
};

test("session: no token -> 401 without calling Supabase", async () => {
  const env = await setup();
  const r = await call(session, "/api/session");
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, "unauthenticated");
  assert.equal(env.supabase.calls.length, 0);
  assertApiHeaders(r.headers);
});

test("session: malformed Authorization headers -> 401 without calling Supabase", async () => {
  const env = await setup();
  const t = login(env).token;
  for (const authorization of ["Basic abc", `bearer ${t}`, `Bearer  ${t}`, "Bearer abc", `Bearer ${t} extra`, `Bearer ${t}\u0000`, "Bearer a.b.c", `Token ${t}`, `Bearer ${"a".repeat(5000)}.b.c`]) {
    let r;
    try { r = await call(session, "/api/session", { authorization }); } catch { continue; } // Headers() itself refuses NUL
    assert.equal(r.status, 401, authorization.slice(0, 30));
  }
  assert.equal(env.supabase.calls.length, 0);
});

test("session: a token Supabase rejects (forged, revoked, wrong project) -> 401", async () => {
  const env = await setup();
  const t = login(env).token;
  const forged = t.slice(0, t.lastIndexOf(".") + 1) + "x".repeat(43);
  assert.equal((await call(session, "/api/session", { token: forged })).status, 401);
  env.supabase.revoke(t);
  assert.equal((await call(session, "/api/session", { token: t })).status, 401);
  // We send the publishable key as apikey and the user's token as Bearer; nothing else.
  assert.ok(env.supabase.calls.every((c) => c.path === "/auth/v1/user" && c.apikey === SUPABASE_PUBLISHABLE_KEY && c.hasSignal));
});

test("session: admin -> 200 { email, isAdmin: true }; admin list is trimmed and case-insensitive", async () => {
  const env = await setup();
  const r = await call(session, "/api/session", { token: login(env, { email: "Owner@Example.com" }).token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { email: ADMIN_EMAIL, isAdmin: true });
  assertApiHeaders(r.headers);
  const other = await call(session, "/api/session", { token: login(env, { email: "someone@other.test" }).token });
  assert.deepEqual(other.body, { email: "someone@other.test", isAdmin: true });
});

test("session: signed-in non-admin -> 200 { isAdmin: false }; console endpoints -> 403", async () => {
  const env = await setup();
  const { token } = login(env, { email: "visitor@example.com" });
  const r = await call(session, "/api/session", { token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { email: "visitor@example.com", isAdmin: false });
  const a = await call(agents, "/api/agents", { token });
  assert.equal(a.status, 403);
  assert.equal(a.body.error.code, "not_admin");
  // Lookalike emails are not admins.
  for (const email of ["owner@example.com.evil.test", "xowner@example.com", "owner@example.co"]) {
    assert.equal((await call(agents, "/api/agents", { token: login(env, { email }).token }, ctx(`198.51.100.${email.length}`))).status, 403, email);
  }
});

test("unconfirmed email -> 403 'confirm your email' (session and console); confirmed_at also counts", async () => {
  const env = await setup();
  const { token } = login(env, { confirmed: false });
  const r = await call(session, "/api/session", { token });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.message, "confirm your email");
  const a = await call(agents, "/api/agents", { token });
  assert.equal(a.status, 403);
  assert.equal(a.body.error.code, "email_unconfirmed");
  const alt = login(env, { confirmedField: "confirmed_at" });
  assert.equal((await call(agents, "/api/agents", { token: alt.token })).status, 200);
});

test("banned admin account -> 403", async () => {
  const env = await setup();
  const { token } = login(env, { bannedUntil: new Date(env.clock.t.getTime() + 864e5) });
  assert.equal((await call(agents, "/api/agents", { token })).status, 403);
});

test("agents: admin token -> 200 with only public agent fields", async () => {
  const env = await setup();
  const r = await call(agents, "/api/agents", { token: login(env).token });
  assert.equal(r.status, 200);
  assert.equal(r.body.agents.length, 12);
  for (const a of r.body.agents) assert.deepEqual(Object.keys(a).sort(), ["description", "model", "name", "personality"]);
  assertApiHeaders(r.headers);
});

for (const mode of ["down", "hang", "500", "429", "badjson"]) {
  test(`Supabase ${mode} -> 503, never allow (session and console endpoint)`, async () => {
    const env = await setup();
    const { token } = login(env);
    env.supabase.setMode(mode);
    const r = await call(session, "/api/session", { token });
    assert.equal(r.status, 503, `session ${mode}`);
    assert.equal(r.body.error.code, "auth_unavailable");
    const a = await call(agents, "/api/agents", { token });
    assert.equal(a.status, 503, `agents ${mode}`);
  });
}

test("successful verifications are cached <= 60 s (keyed by token hash); failures are not cached", async () => {
  const env = await setup();
  const { token } = login(env);
  for (let i = 0; i < 3; i++) assert.equal((await call(session, "/api/session", { token })).status, 200);
  assert.equal(env.supabase.calls.length, 1);
  // Revoked at Supabase: still accepted inside the 60 s window, rejected after it.
  env.supabase.revoke(token);
  env.advance(59 * 1000);
  assert.equal((await call(session, "/api/session", { token })).status, 200);
  env.advance(2 * 1000);
  assert.equal((await call(session, "/api/session", { token })).status, 401);
  assert.equal(env.supabase.calls.length, 2);
  // A rejected token is asked about every time (no negative cache that an attacker could poison).
  assert.equal((await call(session, "/api/session", { token })).status, 401);
  assert.equal(env.supabase.calls.length, 3);
});

test("cache never outlives the token's own exp claim", async () => {
  const env = await setup();
  const { token } = login(env, { expInS: 10 });
  assert.equal((await call(session, "/api/session", { token })).status, 200);
  env.supabase.revoke(token);
  env.advance(11 * 1000);
  assert.equal((await call(session, "/api/session", { token })).status, 401);
});

test("Supabase down after a cached success: cached token still works until the cache expires, then 503", async () => {
  const env = await setup();
  const { token } = login(env);
  assert.equal((await call(session, "/api/session", { token })).status, 200);
  env.supabase.setMode("down");
  assert.equal((await call(session, "/api/session", { token })).status, 200);
  env.advance(61 * 1000);
  assert.equal((await call(session, "/api/session", { token })).status, 503);
});

test("Netlify rate-limit rules: exactly two, on session (30/60 s) and agent-chat (20/60 s)", async () => {
  assert.deepEqual(sessionConfig.rateLimit, { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] });
  assert.deepEqual(chatConfig.rateLimit, { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] });
  let rules = 0;
  for (const f of await readdir("netlify/functions")) {
    if ((await import(`../../netlify/functions/${f}`)).config?.rateLimit) rules++;
  }
  assert.equal(rules, 2);
});

test("old password/cookie endpoints are gone", async () => {
  const files = await readdir("netlify/functions");
  assert.ok(!files.includes("auth-login.mjs"));
  assert.ok(!files.includes("auth-logout.mjs"));
});

test("session: POST -> 405", async () => {
  const env = await setup();
  assert.equal((await call(session, "/api/session", { method: "POST", token: login(env).token })).status, 405);
});

test("Blobs-counter rate limit on /api/agents: 31st request in a minute gets 429", async () => {
  const env = await setup();
  const { token } = login(env);
  for (let i = 0; i < 30; i++) assert.equal((await call(agents, "/api/agents", { token })).status, 200);
  const r = await call(agents, "/api/agents", { token });
  assert.equal(r.status, 429);
  assert.equal(r.body.error.code, "rate_limited");
});

test("deploy contexts are isolated: Blobs counters for a deploy-preview never land in production keys", async () => {
  const env = await setup();
  const { token } = login(env);
  assert.equal((await call(agents, "/api/agents", { token }, ctx("203.0.113.7", "deploy-preview"))).status, 200);
  const keys = (await env.blobs.getStore("counters").list({ prefix: "" })).blobs.map((b) => b.key);
  assert.ok(keys.length > 0 && keys.every((k) => k.startsWith("deploy-preview/")), JSON.stringify(keys));
});
