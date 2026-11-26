// A deploy without console setup must fail closed: every /api endpoint returns 503 "console not configured",
// never calls Supabase, never calls Claude, never touches GitHub, never opens a Blobs store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { setup, call, login } from "../helpers/harness.mjs";
import { REQUIRED_CONSOLE_VARS } from "../../netlify/lib/configured.mjs";

const NAMES = (await readdir("netlify/functions")).filter((f) => f.endsWith(".mjs")).map((f) => f.slice(0, -4)).sort();
const mods = Object.fromEntries(await Promise.all(NAMES.map(async (n) => [n, await import(`../../netlify/functions/${n}.mjs`)])));
const requests = {
  session: {},
  agents: {},
  "agent-chat": { method: "POST", body: { agent: "qa-engineer", conversationId: null, turnId: randomUUID(), input: { type: "message", text: "hi" } } },
  proposals: {},
  "proposal-approve": { method: "POST", body: { id: "p_testproposal000000001" } },
  "proposal-reject": { method: "POST", body: { id: "p_testproposal000000001" } },
};

test("the required set is exactly the Supabase + Claude + GitHub variables", () => {
  assert.deepEqual([...REQUIRED_CONSOLE_VARS].sort(), ["ANTHROPIC_API_KEY", "CONSOLE_ADMIN_EMAILS", "GITHUB_TOKEN", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_URL"]);
  assert.deepEqual(NAMES, Object.keys(requests).sort(), "every function has a fail-closed case");
});

for (const missing of [...REQUIRED_CONSOLE_VARS, "ALL"]) {
  test(`without ${missing === "ALL" ? "any console variable" : missing}: every endpoint returns 503 console not configured`, async () => {
    const over = Object.fromEntries((missing === "ALL" ? REQUIRED_CONSOLE_VARS : [missing]).map((k) => [k, undefined]));
    const env = await setup({ claudeScript: [{ text: "should never run" }], envOverrides: over });
    const { token } = login(env); // even a valid admin token gets nothing
    for (const n of NAMES) {
      const r = await call(mods[n].default, mods[n].config.path, { ...requests[n], token });
      assert.equal(r.status, 503, n);
      assert.equal(r.body.error.code, "not_configured", n);
      assert.equal(r.body.error.message, "console not configured", n);
      assert.equal(r.headers.get("set-cookie"), null, n);
      assert.equal(r.headers.get("cache-control"), "no-store", n);
    }
    assert.equal(env.supabase.calls.length, 0, "no Supabase calls");
    assert.equal(env.claude.calls.length, 0, "no Claude calls");
    assert.equal(env.gh.log.length, 0, "no GitHub requests at all");
    assert.equal(env.blobs.stores.size, 0, "no Blobs store opened");
  });
}

test("blank (whitespace) values and an admin list with no email count as unset", async () => {
  for (const over of [{ SUPABASE_PUBLISHABLE_KEY: "   " }, { CONSOLE_ADMIN_EMAILS: " , ," }, { CONSOLE_ADMIN_EMAILS: "owner" }, { SUPABASE_URL: "   " }]) {
    const env = await setup({ envOverrides: over });
    const r = await call(mods.session.default, "/api/session", { token: login(env).token });
    assert.equal(r.status, 503, JSON.stringify(over));
    assert.equal(env.supabase.calls.length, 0);
  }
});

test("the removed CONSOLE_PASSWORD_HASH and SESSION_SECRET are no longer needed", async () => {
  const env = await setup({ envOverrides: { CONSOLE_PASSWORD_HASH: undefined, SESSION_SECRET: undefined } });
  assert.equal((await call(mods.session.default, "/api/session", { token: login(env).token })).status, 200);
});
