// Function tests: proposal view, approve (atomic GitHub commit via mock), reject, stale base, failures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, call, login } from "../helpers/harness.mjs";
import loginFn from "../../netlify/functions/auth-login.mjs";
import proposals from "../../netlify/functions/proposals.mjs";
import approve from "../../netlify/functions/proposal-approve.mjs";
import reject from "../../netlify/functions/proposal-reject.mjs";
import { PASSWORD } from "../helpers/harness.mjs";

async function seed(env, over = {}) {
  const id = "p_testproposal000000001";
  const p = { schemaVersion: 1, id, status: "pending", agent: "flood-risk-scientist", conversationId: "c_x", baseSha: env.gh.head(),
    summary: "Add a decision", files: [{ path: "docs/decisions.md", content: "# Decisions\nNew line.\n" }],
    createdAt: env.clock.t.toISOString(), expiresAt: new Date(env.clock.t.getTime() + 7 * 864e5).toISOString(), ...over };
  await env.blobs.getStore("proposals").setJSON(`production/${id}`, p);
  return id;
}
const post = (fn, path, s, body) => call(fn, path, { method: "POST", body, cookie: s.cookie, csrf: s.csrf });
const stored = async (env, id) => env.blobs.getStore("proposals").get(`production/${id}`, { type: "json" });

test("GET proposal returns before/after for the diff; list shows it; 401 without session", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env);
  assert.equal((await call(proposals, `/api/proposals?id=${id}`)).status, 401);
  const r = await call(proposals, `/api/proposals?id=${id}`, { cookie: s.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.body.proposal.files[0].before, "# Decisions\n");
  assert.equal(r.body.proposal.files[0].after, "# Decisions\nNew line.\n");
  const list = await call(proposals, "/api/proposals", { cookie: s.cookie });
  assert.deepEqual(list.body.proposals.map((p) => p.id), [id]);
  assert.equal((await call(proposals, "/api/proposals?id=../x", { cookie: s.cookie })).status, 400);
});

test("approve commits once (atomic Git Data flow), records the commit, and a replay returns 409 without a second commit", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env);
  const r = await post(approve, "/api/proposal-approve", s, { id });
  assert.equal(r.status, 200);
  assert.match(r.body.commitSha, /^[0-9a-f]{40}$/);
  assert.equal(r.body.commitUrl, `https://github.com/${env.gh.owner}/${env.gh.repo}/commit/${r.body.commitSha}`);
  assert.equal(env.gh.fileAtHead("docs/decisions.md"), "# Decisions\nNew line.\n");
  assert.match(env.gh.commitMessage(r.body.commitSha), /^agent\(flood-risk-scientist\): Add a decision\n\nProposal-Id: p_testproposal000000001/);
  assert.equal((await stored(env, id)).status, "committed");
  const patches = env.gh.log.filter((l) => l.method === "PATCH").length;
  const replay = await post(approve, "/api/proposal-approve", s, { id });
  assert.equal(replay.status, 409);
  assert.equal(replay.body.error.code, "already_processed");
  assert.equal(replay.body.error.commitSha, r.body.commitSha);
  assert.equal(env.gh.log.filter((l) => l.method === "PATCH").length, patches);
  const sentHeaders = env.gh.log.find((l) => l.method === "POST").headers;
  assert.equal(sentHeaders["x-github-api-version"], "2026-03-10");
});

test("approve needs recent auth: after 15 min it requires the password; wrong password 403", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env);
  env.advance(16 * 60 * 1000);
  const r = await post(approve, "/api/proposal-approve", s, { id });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "reauth_required");
  assert.equal((await post(approve, "/api/proposal-approve", s, { id, password: "wrong" })).body.error.code, "wrong_password");
  assert.equal((await post(approve, "/api/proposal-approve", s, { id, password: PASSWORD })).status, 200);
});

test("stale base: main changed the same file since the proposal -> 409 stale, nothing committed", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env);
  env.gh.push({ "docs/decisions.md": "# Decisions\nSomeone else.\n" }, "human edit");
  const head = env.gh.head();
  const r = await post(approve, "/api/proposal-approve", s, { id });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "stale");
  assert.deepEqual(r.body.error.paths, ["docs/decisions.md"]);
  assert.equal(env.gh.head(), head);
  assert.equal((await stored(env, id)).status, "stale");
});

test("unrelated change on main still commits on the new head", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env);
  env.gh.push({ "README.md": "changed\n" }, "unrelated");
  assert.equal((await post(approve, "/api/proposal-approve", s, { id })).status, 200);
  assert.equal(env.gh.fileAtHead("README.md"), "changed\n");
});

test("GitHub failure -> 502, proposal back to pending with lastError", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env);
  env.gh.failNext("POST", 500);
  const r = await post(approve, "/api/proposal-approve", s, { id });
  assert.equal(r.status, 502);
  const p = await stored(env, id);
  assert.equal(p.status, "pending");
  assert.match(p.lastError, /commit failed/);
});

test("allow-list is re-checked at approve: a tampered stored proposal touching netlify/ is refused", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env, { files: [{ path: "netlify/functions/agent-chat.mjs", content: "evil" }] });
  const r = await post(approve, "/api/proposal-approve", s, { id });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "proposal_invalid");
  assert.equal(env.gh.writes(), 0);
});

test("expired proposals (7 days) cannot be approved", async () => {
  const env = await setup();
  const id = await seed(env);
  env.advance(7 * 864e5 + 1000);
  const s = await login(loginFn); // fresh session (sessions last 8 h)
  const r = await post(approve, "/api/proposal-approve", s, { id, password: PASSWORD });
  assert.equal(r.status, 410);
});

test("reject: pending -> rejected; then approve is refused", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env);
  const r = await post(reject, "/api/proposal-reject", s, { id, note: "Not now" });
  assert.equal(r.status, 200);
  assert.equal((await stored(env, id)).status, "rejected");
  assert.equal((await post(approve, "/api/proposal-approve", s, { id })).status, 409);
  assert.equal((await post(reject, "/api/proposal-reject", s, { id })).status, 409);
});

test("approve and reject require CSRF and same Origin", async () => {
  const env = await setup();
  const s = await login(loginFn);
  const id = await seed(env);
  assert.equal((await call(approve, "/api/proposal-approve", { method: "POST", body: { id }, cookie: s.cookie })).status, 403);
  assert.equal((await call(approve, "/api/proposal-approve", { method: "POST", body: { id }, cookie: s.cookie, csrf: s.csrf, origin: "https://evil.test" })).status, 403);
  assert.equal((await call(reject, "/api/proposal-reject", { method: "POST", body: { id }, cookie: s.cookie })).status, 403);
  assert.equal(env.gh.writes(), 0);
});
