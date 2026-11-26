// A deploy without console setup must fail closed: every /api endpoint returns 503 "console not configured",
// never sets a cookie, never calls Claude, never touches GitHub, never writes Blobs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setup, call, PASSWORD } from "../helpers/harness.mjs";
import { REQUIRED_CONSOLE_VARS } from "../../netlify/lib/configured.mjs";

const NAMES = ["auth-login", "auth-logout", "session", "agents", "agent-chat", "proposals", "proposal-approve", "proposal-reject"];
const mods = Object.fromEntries(await Promise.all(NAMES.map(async (n) => [n, await import(`../../netlify/functions/${n}.mjs`)])));
const requests = {
  "auth-login": { method: "POST", body: { password: PASSWORD } },
  "auth-logout": { method: "POST" },
  session: {},
  agents: {},
  "agent-chat": { method: "POST", body: { agent: "qa-engineer", conversationId: null, turnId: randomUUID(), input: { type: "message", text: "hi" } } },
  proposals: {},
  "proposal-approve": { method: "POST", body: { id: "p_testproposal000000001", password: PASSWORD } },
  "proposal-reject": { method: "POST", body: { id: "p_testproposal000000001" } },
};

for (const missing of [...REQUIRED_CONSOLE_VARS, "ALL"]) {
  test(`without ${missing === "ALL" ? "any console variable" : missing}: every endpoint returns 503 console not configured`, async () => {
    const over = Object.fromEntries((missing === "ALL" ? REQUIRED_CONSOLE_VARS : [missing]).map((k) => [k, undefined]));
    const env = await setup({ claudeScript: [{ text: "should never run" }], envOverrides: over });
    for (const n of NAMES) {
      const r = await call(mods[n].default, mods[n].config.path, requests[n]);
      assert.equal(r.status, 503, n);
      assert.equal(r.body.error.code, "not_configured", n);
      assert.equal(r.body.error.message, "console not configured", n);
      assert.equal(r.headers.get("set-cookie"), null, n);
      assert.equal(r.headers.get("cache-control"), "no-store", n);
    }
    assert.equal(env.claude.calls.length, 0, "no Claude calls");
    assert.equal(env.gh.log.length, 0, "no GitHub requests at all");
    assert.equal(env.blobs.stores.size, 0, "no Blobs store opened");
  });
}

test("blank (whitespace) values count as unset", async () => {
  await setup({ envOverrides: { SESSION_SECRET: "   " } });
  const r = await call(mods.session.default, "/api/session");
  assert.equal(r.status, 503);
});
