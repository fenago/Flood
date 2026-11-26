// Runs the handler against the local mock and checks the SSE it returns.
import assert from "node:assert/strict";
import { startMockAnthropic } from "./mock-anthropic.mjs";

const mock = await startMockAnthropic();
process.env.ANTHROPIC_BASE_URL = mock.url;
process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
const { default: handler } = await import("./agent-chat-stream.mjs");

const req = new Request("http://localhost/api/agent-chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    system: "You are flood-risk-scientist.",
    messages: [{ role: "user", content: "Risk in Miami Beach?" }],
  }),
});
const res = await handler(req);
assert.equal(res.headers.get("content-type"), "text/event-stream; charset=utf-8");
const text = await res.text();
mock.close();

const events = text.trim().split("\n\n").map((block) => {
  const [e, d] = block.split("\n");
  return { event: e.slice(7), data: JSON.parse(d.slice(6)) };
});
const deltas = events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
const done = events.find((e) => e.event === "done");

assert.equal(deltas, "Low flood risk today.");
assert.equal(done.data.stop_reason, "end_turn");
assert.equal(done.data.usage.output_tokens, 7);

const sent = mock.seen[0];
assert.equal(sent.url, "/v1/messages");
assert.equal(sent.body.stream, true);
assert.equal(sent.body.model, "claude-opus-5-5");
assert.deepEqual(sent.body.thinking, { type: "adaptive" });
assert.deepEqual(sent.body.output_config, { effort: "medium" });
assert.ok(!("temperature" in sent.body) && !("top_p" in sent.body));

console.log("SSE events:", events.map((e) => e.event).join(","));
console.log("text:", JSON.stringify(deltas), "stop_reason:", done.data.stop_reason);
console.log("request headers: anthropic-version =", sent.headers["anthropic-version"],
  "| auth scheme =", (sent.headers["authorization"] || "").split(" ")[0] || "(x-api-key)");
console.log("PASS 01-stream-sse");
