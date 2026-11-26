// Server-Sent Events writer for /api/agent-chat (one event = `event:` line + one `data:` JSON line).
const enc = new TextEncoder();
export function sseStream() {
  let controller;
  let closed = false;
  const stream = new ReadableStream({ start(c) { controller = c; }, cancel() { closed = true; } });
  return {
    stream,
    get closed() { return closed; },
    send(event, data) { if (!closed) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); },
    ping() { if (!closed) controller.enqueue(enc.encode(": keep-alive\n\n")); },
    close() { if (!closed) { closed = true; controller.close(); } },
  };
}
