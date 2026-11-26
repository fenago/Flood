// Function tests: /api/agent-chat with a scripted Claude client and an in-memory GitHub. No paid calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setup, call, login, parseSse, ctx } from "../helpers/harness.mjs";
import loginFn from "../../netlify/functions/auth-login.mjs";
import chat, { config } from "../../netlify/functions/agent-chat.mjs";

const send = (s, body, extra = {}) => call(chat, "/api/agent-chat", { method: "POST", body, cookie: s.cookie, csrf: s.csrf, ...extra });
const msg = (text, conversationId = null, agent = "flood-risk-scientist") => ({ agent, conversationId, turnId: randomUUID(), input: { type: "message", text } });
const cont = (conversationId, agent = "flood-risk-scientist") => ({ agent, conversationId, turnId: randomUUID(), input: { type: "continue" } });

test("chat uses the second Netlify rule (20 / 60 s)", () => assert.equal(config.rateLimit.windowLimit, 20));

test("auth, CSRF, validation and unknown agent are checked before any Claude call", async () => {
  const env = await setup();
  const s = await login(loginFn);
  assert.equal((await call(chat, "/api/agent-chat", { method: "POST", body: msg("hi") })).status, 401); // no session
  assert.equal((await send({ cookie: s.cookie, csrf: "x.y" }, msg("hi"))).status, 403);
  assert.equal((await send(s, msg("hi"), { origin: "https://evil.test" })).status, 403);
  assert.equal((await send(s, { ...msg("hi"), model: "claude-opus-5-5" })).status, 400); // client never picks the model
  assert.equal((await send(s, { ...msg("hi"), turnId: "not-a-uuid" })).status, 400);
  assert.equal((await send(s, msg("x".repeat(8001)))).status, 400);
  assert.equal((await send(s, msg("hi", null, "../../etc"))).status, 404);
  assert.equal((await send(s, msg("hi", null, "no-such-agent"))).status, 404);
  assert.equal(env.claude.calls.length, 0);
});

test("text-only turn streams start/text/done and sends the right request to Claude", async () => {
  const env = await setup({ claudeScript: [{ chunks: ["Low ", "risk today."] }] });
  const s = await login(loginFn);
  const r = await send(s, msg("Any flood risk?"));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/event-stream/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  const ev = parseSse(r.body);
  assert.deepEqual(ev.map((e) => e.event), ["start", "text", "text", "done"]);
  assert.equal(ev[0].data.model, "claude-opus-5-5"); // flood-risk-scientist is `model: opus`
  assert.deepEqual(ev[3].data.stopReason, "end_turn");
  assert.equal(ev[3].data.next, "none");
  const p = env.claude.calls[0];
  assert.deepEqual(p.thinking, { type: "adaptive" });
  assert.deepEqual(p.output_config, { effort: "high" }); // agent frontmatter effort: high
  assert.deepEqual(p.tool_choice, { type: "auto" });
  assert.deepEqual(p.tools.map((t) => [t.name, t.strict, t.input_schema.additionalProperties]), [["read_file", true, false], ["list_files", true, false], ["propose_change", true, false]]);
  assert.equal(p.system[0].cache_control.type, "ephemeral");
  assert.match(p.system[0].text, /You cannot commit/);
  assert.equal(p.max_tokens, 16000);
  for (const k of ["temperature", "top_p", "budget_tokens"]) assert.equal(k in p, false);
  assert.equal(p.messages.at(-1).role, "user");
});

test("sonnet agents map to claude-sonnet-5-5 with default effort medium", async () => {
  const env = await setup({ claudeScript: [{ text: "hi" }] });
  const s = await login(loginFn);
  await send(s, msg("hi", null, "qa-engineer"));
  assert.equal(env.claude.calls[0].model, "claude-sonnet-5-5");
  assert.deepEqual(env.claude.calls[0].output_config, { effort: "medium" });
});

test("tool loop: read_file -> continue -> propose_change stores a pending proposal; nothing is committed", async () => {
  const env = await setup({ claudeScript: [
    { text: "Reading.", toolUses: [{ name: "read_file", input: { path: "docs/decisions.md" } }, { name: "read_file", input: { path: ".env" } }] },
    { text: "Proposing.", toolUses: [{ name: "propose_change", input: { summary: "Add a decision", files: [{ path: "docs/decisions.md", content: "# Decisions\nNew.\n" }] } }] },
    { text: "Done." },
  ] });
  const s = await login(loginFn);
  const r1 = parseSse((await send(s, msg("Add a decision"))).body);
  const conv = r1[0].data.conversationId;
  assert.match(conv, /^c_/);
  const tools = r1.filter((e) => e.event === "tool" && e.data.status !== "started");
  assert.deepEqual(tools.map((t) => t.data.status), ["ok", "error"]); // .env read refused
  assert.equal(r1.at(-1).data.next, "continue");
  // tool results went back as ONE user message, with the file content and the refusal
  const r2 = parseSse((await send(s, cont(conv))).body);
  const sent = env.claude.calls[1].messages.at(-1);
  assert.equal(sent.role, "user");
  assert.equal(sent.content.length, 2);
  assert.equal(sent.content[0].content, "# Decisions\n");
  assert.equal(sent.content[1].is_error, true);
  const prop = r2.find((e) => e.event === "proposal");
  assert.ok(prop, "proposal event");
  assert.deepEqual(prop.data.files, [{ path: "docs/decisions.md", bytes: 17 }]);
  const stored = await env.blobs.getStore("proposals").get(`production/${prop.data.proposalId}`, { type: "json" });
  assert.equal(stored.status, "pending");
  assert.equal(stored.baseSha, env.gh.head());
  assert.equal(env.gh.writes(), 0, "no GitHub writes from chat");
  const r3 = parseSse((await send(s, cont(conv))).body);
  assert.equal(r3.at(-1).data.next, "none");
});

test("propose_change with denied or traversal paths is rejected as a tool error and stores nothing", async () => {
  const env = await setup({ claudeScript: [{ toolUses: [{ name: "propose_change", input: { summary: "x", files: [
    { path: "netlify/functions/agent-chat.mjs", content: "evil" }, { path: "docs/../netlify.toml", content: "x" }, { path: "public/sw.js", content: "x" }] } }] }] });
  const s = await login(loginFn);
  const ev = parseSse((await send(s, msg("do it"))).body);
  assert.equal(ev.find((e) => e.event === "proposal"), undefined);
  const tool = ev.filter((e) => e.event === "tool").at(-1);
  assert.equal(tool.data.status, "error");
  const keys = [...(env.blobs.stores.get("proposals")?.list ? (await env.blobs.getStore("proposals").list()).blobs : [])];
  assert.equal(keys.length, 0);
});

test("duplicate turnId is refused (409) and does not call Claude twice", async () => {
  const env = await setup({ claudeScript: [{ text: "a" }, { text: "b" }] });
  const s = await login(loginFn);
  const first = parseSse((await send(s, msg("hi"))).body);
  const conv = first[0].data.conversationId;
  const body = msg("again", conv);
  assert.equal((await send(s, body)).status, 200);
  const dup = await send(s, body);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "duplicate_turn");
  assert.equal(env.claude.calls.length, 2);
});

test("daily token budget: over budget -> 429 budget_exhausted before calling Claude", async () => {
  const env = await setup({ claudeScript: [{ text: "big", inputTokens: 90000, outputTokens: 20000 }], envOverrides: { DAILY_TOKEN_BUDGET: "100000" } });
  const s = await login(loginFn);
  assert.equal((await send(s, msg("one"))).status, 200);
  const r = await send(s, msg("two"));
  assert.equal(r.status, 429);
  assert.equal(r.body.error.code, "budget_exhausted");
  assert.ok(r.body.error.retryAfterSeconds > 0);
  assert.equal(env.claude.calls.length, 1);
});

test("Claude failure mid-turn -> error event, conversation unlocked and unchanged", async () => {
  const env = await setup({ claudeScript: [{ throw: Object.assign(new Error("overloaded"), { status: 529 }) }, { text: "ok now" }] });
  const s = await login(loginFn);
  const ev = parseSse((await send(s, msg("hi"))).body);
  assert.equal(ev.at(-1).event, "error");
  assert.equal(ev.at(-1).data.error.code, "claude_unavailable");
  const conv = ev[0].data.conversationId;
  const again = parseSse((await send(s, msg("retry", conv))).body);
  assert.equal(again.at(-1).event, "done");
  assert.equal(env.claude.calls[1].messages.length, 1, "failed turn was not saved");
});

test("truncated tool call at max_tokens is never executed", async () => {
  const env = await setup({ claudeScript: [{ stop_reason: "max_tokens", toolUses: [{ name: "propose_change", input: { summary: "x", files: [{ path: "docs/a.md", content: "x" }] } }] }] });
  const s = await login(loginFn);
  const ev = parseSse((await send(s, msg("hi"))).body);
  assert.equal(ev.filter((e) => e.event === "tool").length, 0);
  assert.equal(ev.at(-1).data.stopReason, "max_tokens");
});

test("missing ANTHROPIC_API_KEY -> the whole console fails closed (503), even login", async () => {
  const env = await setup({ envOverrides: { ANTHROPIC_API_KEY: undefined } });
  const r = await call(loginFn, "/api/auth-login", { method: "POST", body: { password: "correct horse battery staple" } });
  assert.equal(r.status, 503);
  assert.equal(r.body.error.message, "console not configured");
  assert.equal(env.claude.calls.length, 0);
});
