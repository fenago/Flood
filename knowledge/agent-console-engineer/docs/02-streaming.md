Source: https://platform.claude.com/docs/en/build-with-claude/streaming
Source: https://platform.claude.com/docs/en/api/errors
Source: Claude API skill reference (bundled claude-api skill: typescript/claude-api/streaming.md, typescript/claude-api/tool-use.md)
Retrieved: 2026-11-26

# Streaming messages

## Event order (official streaming page)

1. `message_start` - message metadata, `usage.input_tokens`.
2. Per content block: `content_block_start` -> any number of `content_block_delta` -> `content_block_stop`.
3. One or more `message_delta` - carries `stop_reason` and cumulative `usage.output_tokens`.
4. `message_stop`.

`ping` events (`{"type":"ping"}`) can appear anywhere. Ignore them.

Delta types inside `content_block_delta`:

| `delta.type` | Block | Field |
|---|---|---|
| `text_delta` | text | `delta.text` |
| `input_json_delta` | tool_use | `delta.partial_json` (concatenate, parse at `content_block_stop`) |
| `thinking_delta` | thinking | `delta.thinking` |
| `signature_delta` | thinking | `delta.signature` |

Raw SSE wire format: `event: <name>\ndata: <json>\n\n`.

## Errors in a stream

- An error can arrive **after** the HTTP 200, e.g. `event: error` with `{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}` (would be a 529 outside a stream).
- With the SDK you do not see that event: the SDK ends the stream and the reading code gets an error (rejected `finalMessage()` / thrown in `for await`).
- "The SDK doesn't retry an error in a stream" (errors page). SDK retries (`maxRetries`, default 2) only apply before the stream opens. Decide in our code whether to re-issue the turn.

## TypeScript SDK helpers

```js
const stream = client.messages.stream({ model, max_tokens, system, messages, tools });
stream.on("text", (delta) => send(delta));          // text deltas only
const message = await stream.finalMessage();        // full Anthropic.Message
```

- `for await (const event of stream)` gives raw events if we need `input_json_delta` or thinking.
- Do **not** wrap `.on("message")` / `.on("error")` in `new Promise()`; `finalMessage()` already handles completion, error and abort.
- `stream.abort()` cancels the HTTP request (use it when the browser disconnects so we stop paying for output).
- Use `stream()` + `finalMessage()` in a manual tool loop: stream text each iteration, then inspect `stop_reason` and `tool_use` blocks on the final message.

## Eager input streaming (tools in a streamed request)

- By default the API buffers and validates each tool-input parameter before emitting `input_json_delta`; large inputs (a whole file in `propose_change`) arrive in one late burst.
- `eager_input_streaming: true` on a tool streams fragments as generated, but the server then no longer validates them. Validate the parsed input yourself and treat parse failures like invalid JSON (skill reference `shared/tool-use-concepts.md`).
- Skill reference advice: leave it off when the client points at a custom `baseURL`/gateway unless the upstream is the real API (some proxies reject the field). Our tests use a mock baseURL, so example 02 leaves it off. (Whether to turn it on in production is a decision for us.)

## Netlify Function pattern (verified in examples/01-stream-sse)

```js
export default async (req) => {
  const body = new ReadableStream({ async start(controller) {
    const stream = client.messages.stream({...});
    stream.on("text", (t) => controller.enqueue(sse("delta", { text: t })));
    try { const m = await stream.finalMessage(); controller.enqueue(sse("done", { stop_reason: m.stop_reason })); }
    catch { controller.enqueue(sse("error", { message: "Claude request failed" })); }
    finally { controller.close(); }
  }});
  return new Response(body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" } });
};
```

- Send our own small event names to the browser (`delta`, `done`, `error`), not the raw Anthropic events. Never forward error bodies that might echo request data.
- Keep one Claude turn per request so the Function stays under its time limit (see `long-running-agent-jobs` skill; limits are owned by `netlify-engineer`).

## After the stream ends: check `stop_reason`

| `stop_reason` | Console action |
|---|---|
| `end_turn` | Done. Save the turn. |
| `tool_use` | Run tools, send **all** `tool_result` blocks in one `user` message next turn. |
| `max_tokens` | Text: show as truncated. With a `tool_use`: do **not** run it (input may be cut). |
| `pause_turn` | Append the assistant content and send again to continue. |
| `refusal` | Show a polite message; do not run any tool_use in that turn. |
