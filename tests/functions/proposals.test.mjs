// Function tests: proposal view, approve (atomic GitHub commit via mock), reject, stale base, failures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, call, login } from "../helpers/harness.mjs";
import proposals from "../../netlify/functions/proposals.mjs";
import approve from "../../netlify/functions/proposal-approve.mjs";
import reject from "../../netlify/functions/proposal-reject.mjs";

async function seed(env, over = {}) {
  const id = "p_testproposal000000001";
  const p = { schemaVersion: 1, id, status: "pending", agent: "flood-risk-scientist", conversationId: "c_x", baseSha: env.gh.head(),
    summary: "Add a decision", files: [{ path: "docs/decisions.md", content: "# Decisions\nNew line.\n" }],
    createdAt: env.clock.t.toISOString(), expiresAt: new Date(env.clock.t.getTime() + 7 * 864e5).toISOString(), ...over };
  await env.blobs.getStore("proposals").setJSON(`production/${id}`, p);
  return id;
}
const post = (fn, path, s, body) => call(fn, path, { method: "POST", body, token: s.token });
const stored = async (env, id) => env.blobs.getStore("proposals").get(`production/${id}`, { type: "json" });

test("GET proposal returns before/after for the diff; list shows it; 401 without a token", async () => {
  const env = await setup();
  const s = login(env);
  const id = await seed(env);
  assert.equal((await call(proposals, `/api/proposals?id=${id}`)).status, 401);
  const r = await call(proposals, `/api/proposals?id=${id}`, { token: s.token });
  assert.equal(r.status, 200);
  assert.equal(r.body.proposal.files[0].before, "# Decisions\n");
  assert.equal(r.body.proposal.files[0].after, "# Decisions\nNew line.\n");
  const list = await call(proposals, "/api/proposals", { token: s.token });
  assert.deepEqual(list.body.proposals.map((p) => p.id), [id]);
  assert.equal((await call(proposals, "/api/proposals?id=../x", { token: s.token })).status, 400);
});

test("approve commits once (atomic Git Data flow), records the commit, and a replay returns 409 without a second commit", async () => {
  const env = await setup();
  const s = login(env);
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

test("approve needs a recent sign-in: stale last_sign_in_at -> 403 'sign in again to approve', nothing committed", async () => {
  const env = await setup();
  const id = await seed(env);
  // Token is fresh and valid (refreshed now) but the account last signed in 16 minutes ago.
  const old = login(env, { lastSignInAt: new Date(env.clock.t.getTime() - 16 * 60 * 1000) });
  const r = await post(approve, "/api/proposal-approve", old, { id });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "reauth_required");
  assert.equal(r.body.error.message, "sign in again to approve");
  // A password field no longer bypasses the check (the console has no password).
  assert.equal((await post(approve, "/api/proposal-approve", old, { id, password: "anything" })).status, 403);
  // Same session-bound check via amr: account signed in recently elsewhere, but THIS token's session is old.
  const otherSession = login(env, { amrAt: new Date(env.clock.t.getTime() - 60 * 60 * 1000) });
  assert.equal((await post(approve, "/api/proposal-approve", otherSession, { id })).body.error.code, "reauth_required");
  // token_refresh is not a sign-in.
  const refreshedOnly = login(env, { amr: [{ method: "token_refresh", timestamp: Math.floor(env.clock.t.getTime() / 1000) }] });
  assert.equal((await post(approve, "/api/proposal-approve", refreshedOnly, { id })).body.error.code, "reauth_required");
  assert.equal(env.gh.writes(), 0);
  assert.equal((await stored(env, id)).status, "pending");
  // After the 15-minute window a fresh sign-in works.
  env.advance(1000);
  const fresh = login(env);
  const ok = await post(approve, "/api/proposal-approve", fresh, { id });
  assert.equal(ok.status, 200);
  assert.equal((await stored(env, id)).approvedBy, "owner@example.com");
});

test("approve: a token whose sign-in ages past 15 min is refused, even though the token is still valid", async () => {
  const env = await setup();
  const id = await seed(env);
  const s = login(env);
  env.advance(16 * 60 * 1000); // past the 60 s auth cache too
  const r = await post(approve, "/api/proposal-approve", s, { id });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "reauth_required");
});

test("stale base: main changed the same file since the proposal -> 409 stale, nothing committed", async () => {
  const env = await setup();
  const s = login(env);
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
  const s = login(env);
  const id = await seed(env);
  env.gh.push({ "README.md": "changed\n" }, "unrelated");
  assert.equal((await post(approve, "/api/proposal-approve", s, { id })).status, 200);
  assert.equal(env.gh.fileAtHead("README.md"), "changed\n");
});

test("GitHub failure -> 502, proposal back to pending with lastError", async () => {
  const env = await setup();
  const s = login(env);
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
  const s = login(env);
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
  const s = login(env); // fresh sign-in
  const r = await post(approve, "/api/proposal-approve", s, { id });
  assert.equal(r.status, 410);
});

test("reject: pending -> rejected; then approve is refused", async () => {
  const env = await setup();
  const s = login(env);
  const id = await seed(env);
  const r = await post(reject, "/api/proposal-reject", s, { id, note: "Not now" });
  assert.equal(r.status, 200);
  assert.equal((await stored(env, id)).status, "rejected");
  assert.equal((await post(approve, "/api/proposal-approve", s, { id })).status, 409);
  assert.equal((await post(reject, "/api/proposal-reject", s, { id })).status, 409);
});

test("approve and reject require an admin token and the same Origin (when sent)", async () => {
  const env = await setup();
  const s = login(env);
  const id = await seed(env);
  let n = 0; // a fresh client IP per attempt so the 5/min Blobs rate limit does not mask the status
  const at = () => ({ ip: `198.51.100.${++n}`, requestId: "r", deploy: { context: "production" } });
  assert.equal((await call(approve, "/api/proposal-approve", { method: "POST", body: { id } }, at())).status, 401);
  assert.equal((await call(approve, "/api/proposal-approve", { method: "POST", body: { id }, token: s.token, origin: "https://evil.test" }, at())).status, 403);
  assert.equal((await call(reject, "/api/proposal-reject", { method: "POST", body: { id } }, at())).status, 401);
  assert.equal((await call(reject, "/api/proposal-reject", { method: "POST", body: { id }, token: s.token, origin: "https://evil.test" }, at())).status, 403);
  const visitor = login(env, { email: "visitor@example.com" });
  assert.equal((await call(approve, "/api/proposal-approve", { method: "POST", body: { id }, token: visitor.token }, at())).status, 403);
  assert.equal((await call(reject, "/api/proposal-reject", { method: "POST", body: { id }, token: visitor.token }, at())).status, 403);
  // Origin is optional (bearer tokens are never sent automatically); absent Origin + admin token works.
  assert.equal((await call(reject, "/api/proposal-reject", { method: "POST", body: { id }, token: s.token, origin: null }, at())).status, 200);
  assert.equal((await stored(env, id)).rejectedBy, "owner@example.com");
  assert.equal(env.gh.writes(), 0);
});
