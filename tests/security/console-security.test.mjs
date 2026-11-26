// Security tests: Origin checks, token handling (never logged or stored), replayed and concurrent approvals,
// secrets in output. Supabase, Claude and GitHub are all mocked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setup, call, login, ctx } from "../helpers/harness.mjs";
import approve from "../../netlify/functions/proposal-approve.mjs";
import reject from "../../netlify/functions/proposal-reject.mjs";
import session from "../../netlify/functions/session.mjs";
import agents from "../../netlify/functions/agents.mjs";
import proposals from "../../netlify/functions/proposals.mjs";
import chat from "../../netlify/functions/agent-chat.mjs";
import { originOk } from "../../netlify/lib/auth.mjs";

async function seed(env, id = "p_testproposal000000001") {
  await env.blobs.getStore("proposals").setJSON(`production/${id}`, { id, status: "pending", agent: "qa-engineer", baseSha: env.gh.head(), summary: "x",
    files: [{ path: "docs/a.md", content: "a\n" }], createdAt: env.clock.t.toISOString(), expiresAt: new Date(env.clock.t.getTime() + 864e5).toISOString() });
  return id;
}

test("Origin mismatch on state-changing requests -> 403 before Supabase is asked; nothing committed", async () => {
  const env = await setup();
  const { token } = login(env);
  const id = await seed(env);
  let n = 0; // a fresh client IP per attempt so the approve rate limit (5/min) does not mask the 403
  const cases = [["null", null], ["http://flood.test", null], ["https://flood.test.evil.test", null], ["https://evil.test", null],
    ["https://flood.test", "cross-site"], ["https://flood.test", "same-site"]];
  for (const [origin, sfs] of cases) {
    for (const [fn, path] of [[approve, "/api/proposal-approve"], [reject, "/api/proposal-reject"]]) {
      const r = await call(fn, path, { method: "POST", body: { id }, token, origin, secFetchSite: sfs }, ctx(`198.51.100.${++n}`));
      assert.equal(r.status, 403, `${path} origin=${origin} sfs=${sfs}`);
      assert.equal(r.body.error.code, "origin_rejected");
    }
    const c = await call(chat, "/api/agent-chat", { method: "POST", token, origin, secFetchSite: sfs,
      body: { agent: "qa-engineer", conversationId: null, turnId: randomUUID(), input: { type: "message", text: "hi" } } });
    assert.equal(c.status, 403, `chat origin=${origin}`);
  }
  assert.equal(env.supabase.calls.length, 0, "Origin is checked before the token is sent anywhere");
  assert.equal(env.gh.writes(), 0);
  assert.equal(env.claude.calls.length, 0);
});

test("originOk: GET never counts as a write; absent Origin allowed for bearer-token POSTs; same origin allowed", () => {
  const mk = (method, h = {}) => new Request("https://flood.test/api/x", { method, headers: h });
  assert.equal(originOk(mk("GET", { origin: "https://flood.test" })), false);
  assert.equal(originOk(mk("POST")), true);
  assert.equal(originOk(mk("POST", { origin: "https://flood.test", "sec-fetch-site": "same-origin" })), true);
  assert.equal(originOk(mk("POST", { origin: "https://FLOOD.test" })), false);
});

test("the raw token never appears in logs, Blobs, responses or the GitHub mock", async () => {
  const env = await setup({ claudeScript: [{ text: "Hello." }] });
  const { token } = login(env);
  const bad = login(env, { email: "visitor@example.com" }).token;
  const id = await seed(env);
  const logged = [];
  const orig = {};
  for (const k of ["log", "info", "warn", "error", "debug"]) { orig[k] = console[k]; console[k] = (...a) => logged.push(a.map(String).join(" ")); }
  const bodies = [];
  try {
    const rec = async (p) => { const r = await p; bodies.push(typeof r.body === "string" ? r.body : JSON.stringify(r.body)); return r; };
    await rec(call(session, "/api/session", { token }));
    await rec(call(session, "/api/session", { token: bad }));
    await rec(call(agents, "/api/agents", { token }));
    await rec(call(agents, "/api/agents", { token: bad }));
    await rec(call(proposals, `/api/proposals?id=${id}`, { token }));
    await rec(call(chat, "/api/agent-chat", { method: "POST", token, body: { agent: "qa-engineer", conversationId: null, turnId: randomUUID(), input: { type: "message", text: "hi" } } }));
    await rec(call(reject, "/api/proposal-reject", { method: "POST", token, body: { id } }));
    env.supabase.setMode("down");
    await rec(call(session, "/api/session", { token: bad }));
  } finally { Object.assign(console, orig); }
  const sig = (t) => t.split(".")[2];
  const haystacks = [...logged, ...bodies];
  for (const [name, store] of env.blobs.stores) {
    for (const b of (await store.list()).blobs) haystacks.push(`${name}:${b.key}:${await store.get(b.key)}`);
  }
  haystacks.push(JSON.stringify(env.gh.log), JSON.stringify(env.claude.calls));
  for (const t of [token, bad]) for (const h of haystacks) {
    assert.ok(!h.includes(t), "raw token leaked");
    assert.ok(!h.includes(sig(t)), "token signature leaked");
  }
});

test("concurrent approvals (double click / two tabs) produce exactly one commit", async () => {
  const env = await setup();
  const s = login(env);
  const id = await seed(env, "p_testproposal000000002");
  const rs = await Promise.all(Array.from({ length: 5 }, () => call(approve, "/api/proposal-approve", { method: "POST", body: { id }, token: s.token })));
  const statuses = rs.map((r) => r.status).sort();
  assert.deepEqual(statuses.filter((x) => x === 200).length, 1, JSON.stringify(statuses));
  assert.ok(statuses.filter((x) => x !== 200).every((x) => x === 409), JSON.stringify(rs.map((r) => r.body)));
  assert.equal(env.gh.log.filter((l) => l.method === "PATCH").length, 1);
});

test("a non-admin, an unconfirmed admin, or a Supabase outage can never approve", async () => {
  const env = await setup();
  const id = await seed(env);
  let n = 0;
  for (const opts of [{ email: "visitor@example.com" }, { confirmed: false }]) {
    const r = await call(approve, "/api/proposal-approve", { method: "POST", body: { id }, token: login(env, opts).token }, ctx(`198.51.100.${++n}`));
    assert.equal(r.status, 403, JSON.stringify(opts));
  }
  const { token } = login(env);
  env.supabase.setMode("down");
  assert.equal((await call(approve, "/api/proposal-approve", { method: "POST", body: { id }, token }, ctx(`198.51.100.${++n}`))).status, 503);
  assert.equal(env.gh.writes(), 0);
});

test("SUPABASE_URL must be https: a plain-http or garbage URL fails closed (token never sent in clear)", async () => {
  for (const SUPABASE_URL of ["http://mock-project.supabase.test", "not a url", "https://user:pw@mock-project.supabase.test"]) {
    const env = await setup({ envOverrides: { SUPABASE_URL } });
    const r = await call(session, "/api/session", { token: login(env).token });
    assert.equal(r.status, 503, SUPABASE_URL);
    assert.equal(env.supabase.calls.length, 0);
  }
});

test("no secret-shaped strings in the built site (dist/) or in public/", async () => {
  const PAT = [/sk-ant-[A-Za-z0-9_-]{8,}/, /github_pat_[A-Za-z0-9_]{8,}/, /ghp_[A-Za-z0-9]{20,}/, /scrypt\$\d+\$/, /sb_secret_[A-Za-z0-9_-]{8,}/];
  async function walk(d) { const o = []; for (const n of await readdir(d)) { const p = join(d, n); (await stat(p)).isDirectory() ? o.push(...await walk(p)) : o.push(p); } return o; }
  const roots = ["public"];
  try { await stat("dist"); roots.push("dist"); } catch { /* not built yet */ }
  for (const r of roots) for (const f of await walk(r)) {
    const t = (await readFile(f)).toString("latin1");
    for (const re of PAT) assert.doesNotMatch(t, re, f);
  }
  const agentsJson = JSON.parse(await readFile("public/console/agents.json", "utf8"));
  for (const a of agentsJson.agents) assert.deepEqual(Object.keys(a).sort(), ["description", "model", "name", "personality"]);
});
