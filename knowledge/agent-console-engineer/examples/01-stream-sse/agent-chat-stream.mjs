// Example: a Netlify Function (modern signature) that streams one Claude turn
// to the browser as Server-Sent Events.
//
// Real deployment: this would live in netlify/functions/agent-chat.mjs with a
// `config` export, a session check and a budget check (see docs/04-agent-console.md).
// Those are left out here so the example only shows the streaming part.
import Anthropic from "@anthropic-ai/sdk";

// Netlify.env is available inside Functions; fall back to process.env for local tests.
const env = (k) => globalThis.Netlify?.env?.get(k) ?? process.env[k];

const encoder = new TextEncoder();
const sse = (event, data) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const { system, messages } = await req.json();

  const client = new Anthropic({
    apiKey: env("ANTHROPIC_API_KEY"),
    // Only set in tests (points at a local mock). In production leave it unset.
    baseURL: env("ANTHROPIC_BASE_URL") || undefined,
    maxRetries: 2, // SDK default; retries 408/409/429/5xx before the stream opens
  });

  const body = new ReadableStream({
    async start(controller) {
      const stream = client.messages.stream({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        thinking: { type: "adaptive" },        // Opus 5.5: always on; adaptive is the only accepted value
        output_config: { effort: "medium" },   // say it explicitly (Opus 5.5 default is medium)
        system,
        messages,
        // No temperature / top_p / budget_tokens / assistant prefill: rejected on current models.
      });

      // Forward only text deltas; thinking text is omitted by default anyway.
      stream.on("text", (delta) => controller.enqueue(sse("delta", { text: delta })));

      try {
        const final = await stream.finalMessage(); // resolves after message_stop
        controller.enqueue(
          sse("done", {
            stop_reason: final.stop_reason,          // end_turn | tool_use | max_tokens | pause_turn | refusal
            usage: final.usage,
          }),
        );
      } catch (err) {
        // Mid-stream errors (e.g. overloaded_error) are NOT retried by the SDK.
        const status = err instanceof Anthropic.APIError ? err.status : undefined;
        controller.enqueue(sse("error", { message: "Claude request failed", status }));
      } finally {
        controller.close();
      }
    },
    cancel() {
      // Browser went away: nothing else to do in this sketch. A real handler
      // would call stream.abort() so it stops paying for output tokens.
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
};
