Source: https://platform.claude.com/docs/en/api/errors
Source: https://platform.claude.com/docs/en/api/rate-limits
Source: https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback
Source: Claude API skill reference (bundled claude-api skill: shared/error-codes.md, typescript/claude-api/README.md)
Retrieved: 2026-11-26

# Errors, rate limits and refusals

## HTTP errors (errors page)

| Status | `error.type` | Retry? |
|---|---|---|
| 400 | `invalid_request_error` | No - fix the request |
| 401 | `authentication_error` | No |
| 402 | `billing_error` | No |
| 403 | `permission_error` | No |
| 404 | `not_found_error` | No (bad model ID is a 404) |
| 409 | `conflict_error` | SDK retries |
| 413 | `request_too_large` | No. Messages API max request size **128 MB** |
| 429 | `rate_limit_error` | Yes, after `retry-after` (not for a spend-cap 429) |
| 500 | `api_error` | Yes |
| 504 | `timeout_error` | Yes |
| 529 | `overloaded_error` | Yes |

Error body: `{"type":"error","error":{"type":"...","message":"..."},"request_id":"req_..."}`. Every response has a `request-id` header.

### SDK behaviour (1.14.0 source)

- Retries automatically `maxRetries` times (default **2**) with backoff on 408, 409, 429 and >= 500, honouring `x-should-retry`, `retry-after-ms` and `retry-after` headers.
- No retry for an error inside a stream (see `02-streaming.md`).
- Error classes (all extend `Anthropic.APIError`, with `.status`, `.type`, `.requestID`): `BadRequestError` 400, `AuthenticationError` 401, `PermissionDeniedError` 403, `NotFoundError` 404, `ConflictError` 409, `UnprocessableEntityError` 422, `RateLimitError` 429, `InternalServerError` >= 500, plus `APIConnectionError` / `APIConnectionTimeoutError`.
- Catch most specific first. Never branch on message strings.

```js
try { ... } catch (err) {
  if (err instanceof Anthropic.RateLimitError) return json(429, { error: "busy, try again" });
  if (err instanceof Anthropic.BadRequestError) { log(err.requestID); return json(502, { error: "bad request to Claude" }); }
  if (err instanceof Anthropic.APIError) return json(502, { error: "Claude error", status: err.status });
  throw err;
}
```

Log `requestID` and status. Never log the key, headers or full prompts.

## Rate limits (rate limits page)

- Three limits per model class: RPM, ITPM (input tokens/min), OTPM (output tokens/min). Token-bucket: capacity refills continuously.
- ITPM counts `input_tokens` + `cache_creation_input_tokens`; **`cache_read_input_tokens` do not count** - caching raises effective throughput.
- Start tier (tier 1) example: Opus 5.5, Sonnet 5.5, Haiku 5.5 each 4,000 RPM / 2,000,000 ITPM / 400,000 OTPM.
- Monthly spend caps per tier: Start $500, Build $1,000, Scale $200,000; orgs can set lower limits. A spend-cap 429 has no `retry-after`; on the Messages API `error.details.error_code` is `enforced_spend_limit_reached` (skill reference).
- Headers: `retry-after`, `anthropic-ratelimit-requests-{limit,remaining,reset}`, `anthropic-ratelimit-tokens-*`, `anthropic-ratelimit-input-tokens-*`, `anthropic-ratelimit-output-tokens-*`.
- Our own guard (`rate-limiting-cost-guards` skill) sits in front: per-IP Function rate limit + daily token budget in Blobs, so we hit our 429 long before Anthropic's.

## Refusals (Refusals and fallback page)

- Applies to Opus 5.5/5, Sonnet 5.5, Haiku 5.5 and the Fable/Mythos models.
- A refusal is an HTTP **200** with `stop_reason: "refusal"`; `content` is empty for a decline before output, or holds the partial output for a mid-output decline.
- `stop_details`: `type: "refusal"`, `category` (`cyber`, `bio`, `frontier_llm`, `reasoning_extraction`, `general_harms`, or `null`), `explanation`, `recommended_model` (only when `fallbacks` set).
- Billing: a decline before output is billed only for `bio`, `frontier_llm`, `reasoning_extraction`; mid-stream declines bill input + output streamed so far.
- The conversation can continue: send the assistant content back as received.
- Console handling: show a calm message ("The agent can't help with that request"), store the turn, never run a tool_use from a refused turn.

### Server-side fallback (beta)

- Request field `fallbacks` with beta header `server-side-fallback-2026-07-01` (array form `[{model: "..."}]` or scalar `"default"`; the scalar needs the `-2026-07-01` beta). The API retries the same request on the fallback model inside the same call; a `fallback` content block marks the switch.
- Our docs (`docs/04-agent-console.md`, `claude-messages-api` skill) plan `fallbacks: "default"` on Opus 5.5/Sonnet 5.5. Confirmed by the bundled claude-api skill reference (SKILL.md, Fable 5.2 section): code for `claude-fable-5-2`, `claude-fable-5-1`, `claude-opus-5-5`, `claude-opus-5` or `claude-sonnet-5-5` should include server-side `fallbacks` by default, with beta `server-side-fallback-2026-07-01`; for `claude-sonnet-5-5` prefer the `"default"` form (the array form may name only `claude-sonnet-5`). Haiku 5.5 has no server-side fallback. Not available on the Batches API, Bedrock, Vertex AI or Foundry.
- When echoing a fallback turn back: keep `fallback` and `text` blocks; drop `thinking` and client `tool_use` blocks that come **before** the final `fallback` block.
