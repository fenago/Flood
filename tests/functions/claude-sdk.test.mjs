// Integration: our turn runner with the REAL @anthropic-ai/sdk against a local mock Messages API (SSE).
// Proves request shape and stream handling without a key or network. Never calls api.anthropic.com.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { runClaudeTurn } from "../../netlify/lib/chat.mjs";

function mockServer() {
  const seen = [];
  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const c of req) raw += c;
    const body = JSON.parse(raw || "{}");
    seen.push({ url: req.url, headers: req.headers, body });
    res.writeHead(200, { "content-type": "text/event-stream" });
    const send = (e, d) => res.write(`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`);
    send("message_start", { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
    send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    send("ping", { type: "ping" });
    for (const t of ["Reading ", "the file."]) send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } });
    send("content_block_stop", { type: "content_block_stop", index: 0 });
    send("content_block_start", { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "read_file", input: {} } });
    send("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{\"path\": \"docs/" } });
    send("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "decisions.md\"}" } });
    send("content_block_stop", { type: "content_block_stop", index: 1 });
    send("message_delta", { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 12 } });
    send("message_stop", { type: "message_stop" });
    res.end();
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ url: `http://127.0.0.1:${server.address().port}`, seen, close: () => server.close() })));
}

test("real SDK: streamed text + tool_use with input_json_delta; request carries adaptive thinking, effort, strict tools, auto tool_choice", async () => {
  const m = await mockServer();
  try {
    const client = new Anthropic({ apiKey: "dummy-test-key", baseURL: m.url, maxRetries: 0 });
    const deltas = [];
    const out = await runClaudeTurn({ client, agent: { prompt: "You are a test agent." }, model: "claude-opus-5-5", effort: "high", messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }], onText: (d) => deltas.push(d) });
    assert.deepEqual(deltas, ["Reading ", "the file."]);
    assert.equal(out.message.stop_reason, "tool_use");
    assert.deepEqual(out.message.content[1], { type: "tool_use", id: "toolu_1", name: "read_file", input: { path: "docs/decisions.md" } });
    const b = m.seen[0].body;
    assert.equal(m.seen[0].url, "/v1/messages");
    assert.equal(b.stream, true);
    assert.deepEqual(b.thinking, { type: "adaptive" });
    assert.deepEqual(b.output_config, { effort: "high" });
    assert.deepEqual(b.tool_choice, { type: "auto" });
    assert.ok(b.tools.every((t) => t.strict === true));
    const h = m.seen[0].headers;
    assert.ok(h["x-api-key"] === "dummy-test-key" || h.authorization === "Bearer dummy-test-key", "key sent only to the configured base URL");
  } finally { m.close(); }
});

test("deadline: a hanging stream is aborted and reported as deadline with partial text", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write(`event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "x", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } })}\n\n`);
    res.write(`event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`);
    res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "partial" } })}\n\n`);
    // never ends
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const client = new Anthropic({ apiKey: "dummy", baseURL: `http://127.0.0.1:${server.address().port}`, maxRetries: 0 });
    const out = await runClaudeTurn({ client, agent: { prompt: "p" }, model: "claude-opus-5-5", effort: "low", messages: [{ role: "user", content: "hi" }], onText: () => {}, deadlineMs: 300 });
    assert.equal(out.deadline, true);
    assert.equal(out.partialText, "partial");
  } finally { server.closeAllConnections(); server.close(); }
});
