// Tiny local stand-in for POST /v1/messages that emits a valid Messages
// streaming SSE sequence (message_start, content_block_*, ping, message_delta,
// message_stop). No network, no key. Used only by test.mjs.
import http from "node:http";

export function startMockAnthropic({ chunks = ["Low ", "flood ", "risk today."] } = {}) {
  const seen = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    seen.push({ method: req.method, url: req.url, headers: req.headers, body });

    if (req.method !== "POST" || !req.url.startsWith("/v1/messages")) {
      res.writeHead(404, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "nope" } }));
    }

    res.writeHead(200, { "content-type": "text/event-stream", "request-id": "req_mock_1" });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send("message_start", {
      type: "message_start",
      message: {
        id: "msg_mock_1", type: "message", role: "assistant", model: body.model,
        content: [], stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 42, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      },
    });
    send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    send("ping", { type: "ping" });
    for (const text of chunks) {
      send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
    }
    send("content_block_stop", { type: "content_block_stop", index: 0 });
    send("message_delta", {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 7 },
    });
    send("message_stop", { type: "message_stop" });
    res.end();
  });

  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ url: `http://127.0.0.1:${server.address().port}`, seen, close: () => server.close() }),
    ),
  );
}
