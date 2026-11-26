Source: https://platform.claude.com/docs/en/about-claude/models/overview
Source: https://platform.claude.com/docs/en/api/messages
Source: https://github.com/anthropics/anthropic-sdk-typescript (README as shipped in @anthropic-ai/sdk 1.14.0 on npm)
Source: Claude API skill reference (bundled claude-api skill: typescript/claude-api/README.md, shared/models.md, shared/api-version-migration.md)
Retrieved: 2026-11-26

# Messages API, models and the TypeScript SDK

## Models we may use (Models overview page)

| Model | API ID (alias) | Context | Max output | Price in / out per MTok | Thinking | Default effort |
|---|---|---|---|---|---|---|
| Claude Opus 5.5 (our default) | `claude-opus-5-5` | 1M | 128K | $4 / $20 | adaptive, always on | `medium` |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 1M | 128K | $2 / $10 | adaptive | `high` |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 1M | 128K | from $0.10 / from $0.50 | adaptive | `medium` |
| Claude Fable 5.2 | `claude-fable-5-2` | 1M | 128K | $8 / $40 | adaptive, always on | `high` |

- Use the exact IDs above. Never build an ID by hand. The console maps agent `model:` aliases (`opus`, `sonnet`, `haiku`, `fable`, `inherit`) to these in one module (`agent-model-mapping` skill).
- Haiku 5.5 price rises above 100K prompt tokens ($0.50 / $2.50) (skill reference `shared/models.md`).
- The Models API (`client.models.retrieve(id)`) returns live `max_input_tokens`, `max_tokens` and a `capabilities` tree, if we ever need to check support at run time.

## Things current models reject (400)

- `thinking.budget_tokens` (use `thinking: {type: "adaptive"}` + `output_config.effort`).
- `thinking: {type: "disabled"}` on Opus 5.5 and Sonnet 5.5.
- `temperature`, `top_p`, `top_k`: on API version `2026-10-21` any value is rejected (skill reference, API version migration).
- Assistant prefill (a final `assistant` message for the model to continue) - "no longer supported" since the 4.6 models (prompting best-practices page). Also incompatible with strict tools.
- `tool_choice` `{type:"any"}` or `{type:"tool"}` on Opus 5.5, Sonnet 5.5, Fable 5.1/5.2.

## Request basics

- `POST /v1/messages`. Required body: `model`, `max_tokens`, `messages` (first message must be `user`; consecutive same-role messages are merged).
- Optional: `system` (string or text blocks, can carry `cache_control`), `tools`, `tool_choice`, `thinking`, `output_config` (`effort`, `format`), `stop_sequences`, `metadata`, top-level `cache_control`.
- Response: `id`, `type: "message"`, `role: "assistant"`, `content[]` (discriminated union: `text`, `thinking`, `tool_use`, ...), `model`, `stop_reason`, `stop_details`, `usage`.
- `stop_reason` values: `end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal`.
- The API is stateless: send the full history each turn. Append the whole `response.content` as the assistant turn (do not strip thinking or tool_use blocks).

## The TypeScript SDK (`@anthropic-ai/sdk`)

- Install: `npm install @anthropic-ai/sdk`. Version checked: **1.14.0** (npm, 2026-11-26).
- Runtimes listed in the README: Node.js 20 LTS or later, Deno >= 1.28, Bun >= 1.0, Cloudflare Workers, Vercel Edge, Nitro >= 2.6. TypeScript >= 5.0.
- Browser use is disabled unless `dangerouslyAllowBrowser: true` - we never set it (fixed decision 4: key stays in Functions).
- Client: `new Anthropic({ apiKey, baseURL?, maxRetries?, timeout? })`. `apiKey` defaults to `ANTHROPIC_API_KEY`. In a Netlify Function read it with `Netlify.env.get("ANTHROPIC_API_KEY")`.
- Defaults read from the 1.14.0 source (`client.mjs`): `maxRetries` 2, `timeout` 10 minutes, header `anthropic-version: 2026-10-21`, key sent as `Authorization: Bearer <key>`. (Our example 01 confirmed the last two against a mock.)
- SDK 1.0.0 was the first TypeScript release that sends `2026-10-21`; it also removed Text Completions and client-side compaction in the tool runner (skill reference, API version migration).
- Request IDs: the `request-id` response header; exposed as `_request_id` on responses and `requestID` on errors. Log it, never the key.
- Narrow content by `block.type` before reading `.text`; use SDK types (`Anthropic.MessageParam`, `Anthropic.Tool`, `Anthropic.ToolResultBlockParam`) rather than redefining them.

## Minimal call (from a Function only)

```js
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: Netlify.env.get("ANTHROPIC_API_KEY") });
const msg = await client.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  output_config: { effort: "low" },
  system: agentPrompt,
  messages: [{ role: "user", content: "Hello" }],
});
```

For chat, prefer streaming (see `02-streaming.md`): it avoids HTTP timeouts on long outputs and gives live text.

## Open points

- The Messages API reference page did not render in our scraper; request/response field list above comes from the SDK types and the bundled skill reference.
- Haiku 5.5 pricing tiers come from the skill reference, not the overview page (which says only "From $0.10 / from $0.50").
