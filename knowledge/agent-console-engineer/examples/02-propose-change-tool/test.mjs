// Drives runTurn() against a local mock that streams a tool_use block
// (input_json_delta fragments), once with allowed paths and once with denied ones.
import assert from "node:assert/strict";
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { runTurn } from "./propose-turn.mjs";

let nextInput;
const seen = [];
const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  seen.push(JSON.parse(raw));
  res.writeHead(200, { "content-type": "text/event-stream" });
  const send = (data) => res.write(`event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`);
  send({ type: "message_start", message: { id: "msg_2", type: "message", role: "assistant", model: "claude-opus-5-5",
    content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 900, output_tokens: 1 } } });
  send({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  send({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Here is my proposal." } });
  send({ type: "content_block_stop", index: 0 });
  send({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "propose_change", input: {} } });
  const json = JSON.stringify(nextInput);
  for (let i = 0; i < json.length; i += 25) {
    send({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: json.slice(i, i + 25) } });
  }
  send({ type: "content_block_stop", index: 1 });
  send({ type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 80 } });
  send({ type: "message_stop" });
  res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const client = new Anthropic({ apiKey: "test-not-a-real-key", baseURL: `http://127.0.0.1:${server.address().port}` });

const stored = [];
const saveProposal = async (p) => { stored.push(p); return `p_${stored.length}`; };
const base = { system: "You are pwa-mobile-engineer.", messages: [{ role: "user", content: "Fix the title" }], saveProposal };

// 1) allowed paths
nextInput = { summary: "Fix title", files: [{ path: "public/index.html", content: "<title>Flood Watch</title>" }] };
const ok = await runTurn({ client, ...base });
assert.equal(ok.outcome, "stored");
assert.equal(ok.toolResults[0].tool_use_id, "toolu_1");
assert.equal(stored.length, 1);
assert.equal(stored[0].status, "pending");

// 2) denied / traversal paths -> is_error tool_result, nothing stored
nextInput = { summary: "Sneaky", files: [
  { path: "netlify.toml", content: "x" },
  { path: "docs/../.claude/agents/x.md", content: "x" },
  { path: "public/sw.js", content: "x" },
] };
const bad = await runTurn({ client, ...base });
assert.equal(bad.outcome, "rejected");
assert.equal(bad.toolResults[0].is_error, true);
assert.equal(stored.length, 1);
server.close();

// request shape checks
const r = seen[0];
assert.deepEqual(r.tool_choice, { type: "auto" });
assert.equal(r.tools[0].strict, true);
assert.equal(r.tools[0].input_schema.additionalProperties, false);
assert.equal(r.stream, true);

console.log("turn 1:", ok.outcome, "->", ok.toolResults[0].content);
console.log("turn 2:", bad.outcome, "->", bad.toolResults[0].content);
console.log("PASS 02-propose-change-tool");
