// Function tests: login, session, agents, logout (mocked Blobs; no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, call, login, ctx, PASSWORD } from "../helpers/harness.mjs";
import login_ from "../../netlify/functions/auth-login.mjs";
import session from "../../netlify/functions/session.mjs";
import agents from "../../netlify/functions/agents.mjs";
import logout from "../../netlify/functions/auth-logout.mjs";
import { config as loginConfig } from "../../netlify/functions/auth-login.mjs";

const assertApiHeaders = (h) => {
  assert.equal(h.get("cache-control"), "no-store");
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
};

test("login success sets a __Host- cookie with Secure, HttpOnly, SameSite=Strict, Path=/ and returns a CSRF token", async () => {
  await setup();
  const r = await call(login_, "/api/auth-login", { method: "POST", body: { password: PASSWORD } });
  assert.equal(r.status, 200);
  const c = r.headers.get("set-cookie");
  assert.match(c, /^__Host-fw_session=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+; Max-Age=28800; Path=\/; Secure; HttpOnly; SameSite=Strict$/);
  assert.doesNotMatch(c, /Domain=/i);
  assert.match(r.body.csrfToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assertApiHeaders(r.headers);
});

test("login: wrong password 401 with a generic message; bad origin 403; GET 405; missing config 503", async () => {
  await setup();
  const wrong = await call(login_, "/api/auth-login", { method: "POST", body: { password: "nope" } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error.message, "Wrong password");
  assert.equal((await call(login_, "/api/auth-login", { method: "POST", body: { password: PASSWORD }, origin: "https://evil.test" })).status, 403);
  assert.equal((await call(login_, "/api/auth-login", { method: "POST", body: { password: PASSWORD }, origin: null })).status, 403);
  assert.equal((await call(login_, "/api/auth-login", { method: "POST", body: { password: PASSWORD }, secFetchSite: "cross-site" })).status, 403);
  assert.equal((await call(login_, "/api/auth-login", { method: "GET" })).status, 405);
  await setup({ envOverrides: { CONSOLE_PASSWORD_HASH: undefined } });
  assert.equal((await call(login_, "/api/auth-login", { method: "POST", body: { password: PASSWORD } })).status, 503);
});

test("login lockout: 10 failures in 15 min lock the IP (even the right password), other IPs unaffected", async () => {
  const env = await setup();
  for (let i = 0; i < 10; i++) assert.equal((await call(login_, "/api/auth-login", { method: "POST", body: { password: `bad${i}` } })).status, 401);
  const locked = await call(login_, "/api/auth-login", { method: "POST", body: { password: PASSWORD } });
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers.get("retry-after")) > 0);
  assert.equal((await call(login_, "/api/auth-login", { method: "POST", body: { password: PASSWORD } }, ctx("198.51.100.9"))).status, 200);
  env.advance(15 * 60 * 1000);
  assert.equal((await call(login_, "/api/auth-login", { method: "POST", body: { password: PASSWORD } })).status, 200);
});

test("login uses one of the 2 Netlify rate-limit rules (5 / 60 s per ip+domain)", () => {
  assert.deepEqual(loginConfig.rateLimit, { windowLimit: 5, windowSize: 60, aggregateBy: ["ip", "domain"] });
});

test("session: 401 without cookie, forged cookie, or after expiry; 200 with a valid cookie", async () => {
  const env = await setup();
  assert.equal((await call(session, "/api/session")).status, 401);
  const { cookie } = await login(login_);
  const ok = await call(session, "/api/session", { cookie });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.csrfToken);
  const [name, value] = cookie.split("=");
  const forged = `${name}=${value.split(".")[0]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
  assert.equal((await call(session, "/api/session", { cookie: forged })).status, 401);
  assert.equal((await call(session, "/api/session", { cookie: `${name}=made-up-id.sig` })).status, 401);
  env.advance(8 * 3600 * 1000 + 1000);
  assert.equal((await call(session, "/api/session", { cookie })).status, 401);
});

test("agents: 401 without session; with session lists all agents with only public fields", async () => {
  await setup();
  assert.equal((await call(agents, "/api/agents")).status, 401);
  const { cookie } = await login(login_);
  const r = await call(agents, "/api/agents", { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.body.agents.length, 12);
  for (const a of r.body.agents) assert.deepEqual(Object.keys(a).sort(), ["description", "model", "name", "personality"]);
  assertApiHeaders(r.headers);
});

test("logout needs CSRF, deletes the session server-side and clears the cookie", async () => {
  await setup();
  const { cookie, csrf } = await login(login_);
  assert.equal((await call(logout, "/api/auth-logout", { method: "POST", cookie })).status, 403);
  const r = await call(logout, "/api/auth-logout", { method: "POST", cookie, csrf });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await call(session, "/api/session", { cookie })).status, 401); // replaying the old cookie fails
});

test("deploy contexts are isolated: a deploy-preview session is not valid in production", async () => {
  await setup();
  const { cookie } = await login(login_, ctx("203.0.113.7", "deploy-preview"));
  assert.equal((await call(session, "/api/session", { cookie }, ctx("203.0.113.7", "deploy-preview"))).status, 200);
  assert.equal((await call(session, "/api/session", { cookie }, ctx("203.0.113.7", "production"))).status, 401);
});

test("Blobs-counter rate limit on /api/agents: 31st request in a minute gets 429", async () => {
  await setup();
  const { cookie } = await login(login_);
  for (let i = 0; i < 30; i++) assert.equal((await call(agents, "/api/agents", { cookie })).status, 200);
  const r = await call(agents, "/api/agents", { cookie });
  assert.equal(r.status, 429);
  assert.equal(r.body.error.code, "rate_limited");
});
