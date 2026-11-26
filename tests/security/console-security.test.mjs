// Security tests: CSRF variants, replayed and concurrent approvals, cookie forgery, secrets in output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { setup, call, login, ctx, PASSWORD } from "../helpers/harness.mjs";
import loginFn from "../../netlify/functions/auth-login.mjs";
import approve from "../../netlify/functions/proposal-approve.mjs";
import session from "../../netlify/functions/session.mjs";
import { csrfTokenValid, newCsrfToken, verifyPassword, hashPassword } from "../../netlify/lib/session.mjs";

const secret = "test-session-secret-0123456789-abcdefghijklmnop";

test("CSRF token is bound to the session: another session's token, a tampered token or none is refused", async () => {
  const env = await setup();
  const a = await login(loginFn);
  const b = await login(loginFn);
  const id = "p_testproposal000000001";
  await env.blobs.getStore("proposals").setJSON(`production/${id}`, { id, status: "pending", agent: "qa-engineer", baseSha: env.gh.head(), summary: "x",
    files: [{ path: "docs/a.md", content: "a\n" }], createdAt: env.clock.t.toISOString(), expiresAt: new Date(env.clock.t.getTime() + 864e5).toISOString() });
  let n = 0; // a fresh client IP per attempt so the approve rate limit (5/min) does not mask the 403
  for (const csrf of [b.csrf, `${a.csrf}x`, a.csrf.split(".")[0], "", `${a.csrf}.extra`]) {
    const r = await call(approve, "/api/proposal-approve", { method: "POST", body: { id }, cookie: a.cookie, csrf }, ctx(`198.51.100.${++n}`));
    assert.equal(r.status, 403, `csrf=${csrf}`);
  }
  for (const [origin, sfs] of [["null", null], ["http://flood.test", null], ["https://flood.test.evil.test", null], ["https://flood.test", "cross-site"], ["https://flood.test", "same-site"]]) {
    const r = await call(approve, "/api/proposal-approve", { method: "POST", body: { id }, cookie: a.cookie, csrf: a.csrf, origin, secFetchSite: sfs }, ctx(`198.51.100.${++n}`));
    assert.equal(r.status, 403, `origin=${origin} sfs=${sfs}`);
  }
  assert.equal(env.gh.writes(), 0);
});

test("pure CSRF helpers: token for session A never validates for session B", () => {
  const t = newCsrfToken("session-a", secret);
  assert.equal(csrfTokenValid(t, "session-a", secret), true);
  assert.equal(csrfTokenValid(t, "session-b", secret), false);
  assert.equal(csrfTokenValid(t, "session-a", secret + "x"), false);
});

test("concurrent approvals (double click / two tabs) produce exactly one commit", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = "p_testproposal000000002";
  await env.blobs.getStore("proposals").setJSON(`production/${id}`, { id, status: "pending", agent: "qa-engineer", baseSha: env.gh.head(), summary: "race",
    files: [{ path: "docs/a.md", content: "a\n" }], createdAt: env.clock.t.toISOString(), expiresAt: new Date(env.clock.t.getTime() + 864e5).toISOString() });
  const rs = await Promise.all(Array.from({ length: 5 }, () => call(approve, "/api/proposal-approve", { method: "POST", body: { id }, cookie: s.cookie, csrf: s.csrf })));
  const statuses = rs.map((r) => r.status).sort();
  assert.deepEqual(statuses.filter((x) => x === 200).length, 1, JSON.stringify(statuses));
  assert.ok(statuses.filter((x) => x !== 200).every((x) => x === 409), JSON.stringify(rs.map((r) => r.body)));
  assert.equal(env.gh.log.filter((l) => l.method === "PATCH").length, 1);
});

test("password hashes: weak or malformed stored hashes never verify (no downgrade)", async () => {
  const good = await hashPassword(PASSWORD, { N: 2 ** 15, r: 8, p: 1, keylen: 32, saltBytes: 16 });
  assert.equal(await verifyPassword(PASSWORD, good), true);
  assert.equal(await verifyPassword("wrong", good), false);
  const weak = good.replace("$32768$", "$1024$");
  assert.equal(await verifyPassword(PASSWORD, weak), false);
  for (const bad of [undefined, "", "plain", "scrypt$x$8$1$a$b", "bcrypt$..."]) assert.equal(await verifyPassword(PASSWORD, bad), false);
});

test("session cookie without the right signature or with a long value is rejected", async () => {
  await setup();
  for (const cookie of ["__Host-fw_session=abc", "__Host-fw_session=" + "a".repeat(300) + ".b", "fw_session=abc.def"]) {
    assert.equal((await call(session, "/api/session", { cookie })).status, 401);
  }
});

test("no secret-shaped strings in the built site (dist/) or in public/", async () => {
  const PAT = [/sk-ant-[A-Za-z0-9_-]{8,}/, /github_pat_[A-Za-z0-9_]{8,}/, /ghp_[A-Za-z0-9]{20,}/, /scrypt\$\d+\$/];
  async function walk(d) { const o = []; for (const n of await readdir(d)) { const p = join(d, n); (await stat(p)).isDirectory() ? o.push(...await walk(p)) : o.push(p); } return o; }
  const roots = ["public"];
  try { await stat("dist"); roots.push("dist"); } catch { /* not built yet */ }
  for (const r of roots) for (const f of await walk(r)) {
    const t = (await readFile(f)).toString("latin1");
    for (const re of PAT) assert.doesNotMatch(t, re, f);
  }
  const agents = JSON.parse(await readFile("public/console/agents.json", "utf8"));
  for (const a of agents.agents) assert.deepEqual(Object.keys(a).sort(), ["description", "model", "name", "personality"]);
});
