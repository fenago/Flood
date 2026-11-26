// Exercises the agent-job start + background handlers by calling them the way
// Netlify does (a web Request plus a context object), with an in-memory Blobs
// store that has the documented etag / onlyIfNew / onlyIfMatch semantics.
// No dependencies:  node --test knowledge/netlify-engineer/examples/test-job.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStartHandler } from "./functions/agent-job.core.mjs";
import { makeBackgroundHandler } from "./functions/agent-job-background.core.mjs";
import { memoryStore } from "./memory-blobs.mjs";

const SECRET = "TEST-ONLY-not-a-real-secret";
const jobs = memoryStore();
const proposals = memoryStore();

// Simulates Netlify: the sync function returns; the background request is queued for us to run.
function harness({ authed = true } = {}) {
  const queued = [];
  const start = makeStartHandler({
    requireSession: async () => (authed ? { id: "s1" } : null),
    jobs, secret: SECRET,
    invokeBackground: async (payload) => { queued.push(payload); return new Response(null, { status: 202 }); },
  });
  return { start, queued };
}
export const bgRequest = ({ id, signature }) => new Request("http://localhost/.netlify/functions/agent-job-background", {
  method: "POST", headers: { "content-type": "application/json", "x-job-signature": signature }, body: JSON.stringify({ id }),
});
const post = (body) => new Request("http://localhost/api/agent-job", { method: "POST", body: JSON.stringify(body) });
const ctx = { ip: "203.0.113.7", requestId: "test" };
const proposalCount = async (jobId) =>
  (await proposals.list({ prefix: `prop_${jobId.slice(4)}` })).blobs.length;

test("start: 401 without session, 400 on bad input, no-store headers", async () => {
  assert.equal((await harness({ authed: false }).start(post({ agent: "qa-engineer", task: "x" }), ctx)).status, 401);
  assert.equal((await harness().start(post({ agent: "../etc", task: "x" }), ctx)).status, 400);
  const r = await harness().start(new Request("http://localhost/api/agent-job", { method: "POST", body: "{not json" }), ctx);
  assert.equal(r.status, 400);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("fail mid-job, Netlify retry resumes, second retry is a no-op", async () => {
  const { start, queued } = harness();
  const res = await start(post({ agent: "qa-engineer", task: "write tests" }), ctx);
  assert.equal(res.status, 202);
  const { id } = await res.json();
  assert.equal((await jobs.get(id, { type: "json" })).status, "queued");

  const calls = [];
  let failOnce = true;
  const bg = makeBackgroundHandler({ jobs, proposals, secret: SECRET, runStep: async (job) => {
    calls.push(job.step);
    if (job.step === 1 && failOnce) { failOnce = false; throw new Error("simulated Claude 529"); }
    return `step ${job.step} ok`;
  } });

  await assert.rejects(bg(bgRequest(queued[0])), /simulated/);   // attempt 1 errors
  assert.equal((await jobs.get(id, { type: "json" })).step, 1);    // step 0 was saved
  await bg(bgRequest(queued[0]));                                   // retry after 1 min
  const done = await jobs.get(id, { type: "json" });
  assert.equal(done.status, "done");
  assert.deepEqual(done.output, ["step 0 ok", "step 1 ok", "step 2 ok"]);
  assert.deepEqual(calls, [0, 1, 1, 2]);                            // only the failed step re-ran
  await bg(bgRequest(queued[0]));                                   // retry after 2 min (spurious)
  assert.deepEqual(calls, [0, 1, 1, 2]);                            // no extra work
  assert.equal(await proposalCount(id), 1);
  assert.equal((await proposals.get(`prop_${id.slice(4)}`, { type: "json" })).status, "pending");
});

test("two concurrent runs of the same job: each step saved once, one proposal", async () => {
  const { start, queued } = harness();
  const { id } = await (await start(post({ agent: "qa-engineer", task: "race" }), ctx)).json();
  const bg = makeBackgroundHandler({ jobs, proposals, secret: SECRET,
    runStep: async (job) => { await new Promise((r) => setTimeout(r, 5)); return `s${job.step}`; } });
  await Promise.all([bg(bgRequest(queued[0])), bg(bgRequest(queued[0])), bg(bgRequest(queued[0]))]);
  await bg(bgRequest(queued[0])); // a loser may stop early; one more run (retry/poller) finishes
  const job = await jobs.get(id, { type: "json" });
  assert.equal(job.status, "done");
  assert.deepEqual(job.output, ["s0", "s1", "s2"]); // no duplicated or lost step
  assert.equal(await proposalCount(id), 1);
});

test("forged or truncated signature is ignored", async () => {
  const { start, queued } = harness();
  const { id } = await (await start(post({ agent: "qa-engineer", task: "sig" }), ctx)).json();
  const bg = makeBackgroundHandler({ jobs, proposals, secret: SECRET, runStep: async () => "x" });
  await bg(bgRequest({ id, signature: "forged" }));
  await bg(bgRequest({ id, signature: queued[0].signature.slice(0, -1) + "A" }));
  await bg(bgRequest({ id: "job_../../etc", signature: queued[0].signature }));
  assert.equal((await jobs.get(id, { type: "json" })).status, "queued");
});

test("wall-clock guard pauses the job and keeps saved steps", async () => {
  const { start, queued } = harness();
  const { id } = await (await start(post({ agent: "qa-engineer", task: "slow" }), ctx)).json();
  let t = 0;
  const bg = makeBackgroundHandler({ jobs, proposals, secret: SECRET, wallClockMs: 1000,
    now: () => (t += 700), runStep: async (job) => `s${job.step}` });
  await bg(bgRequest(queued[0]));
  const job = await jobs.get(id, { type: "json" });
  assert.equal(job.status, "paused");
  assert.ok(job.step >= 1 && job.step < 3);
});

test("handler refuses to run when the store returns no ETag", async () => {
  const noEtag = { ...memoryStore(), getWithMetadata: async () => ({ data: { status: "queued", step: 0, totalSteps: 1, output: [] }, etag: undefined }) };
  const { queued, start } = harness();
  await start(post({ agent: "qa-engineer", task: "etag" }), ctx);
  const bg = makeBackgroundHandler({ jobs: noEtag, proposals, secret: SECRET, runStep: async () => "x" });
  await assert.rejects(bg(bgRequest(queued[0])), /no ETag/);
});
