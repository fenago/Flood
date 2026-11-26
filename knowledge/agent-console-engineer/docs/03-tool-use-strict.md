Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use
Source: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
Source: Claude API skill reference (bundled claude-api skill: shared/tool-use-concepts.md, typescript/claude-api/tool-use.md)
Retrieved: 2026-11-26

# Tool use, strict tools and tool_choice

## Tool definition fields (Define tools page)

| Field | Notes |
|---|---|
| `name` | Must match `^[a-zA-Z0-9_-]{1,128}$` |
| `description` | Plain text: what it does, when to use it, how it behaves. Claude relies on it heavily. |
| `input_schema` | JSON Schema object for the parameters |
| `strict` | Optional per tool; `true` turns on grammar-constrained inputs |
| `input_examples` | Optional array of example input objects |
| `eager_input_streaming` | Optional; streamed requests only (see `02-streaming.md`) |

## tool_choice

| Value | Meaning |
|---|---|
| `{type:"auto"}` | Claude decides. Default when `tools` are given. |
| `{type:"any"}` | Must call some tool. |
| `{type:"tool", name}` | Must call that tool. |
| `{type:"none"}` | No tools. Default when no `tools`. |

- **`any` and `tool` return 400** on Claude Opus 5.5, Sonnet 5.5, Fable 5.1/5.2 and Mythos 5.1/5.2, and with manual extended thinking (Define tools page). Error text per skill reference: `tool_choice: type "tool" and "any" are not supported for this model.` (also on `count_tokens` and Batches).
- Use `auto`, say in the prompt when to call the tool ("Use propose_change to suggest edits"), set `strict: true` to keep schema-valid inputs, and check that a call was actually made (auto does not guarantee one).
- `disable_parallel_tool_use: true` (any tool_choice) limits Claude to at most one tool call per response (skill reference; not shown on the Define tools page scrape).

## Strict tool use (Strict tool use page)

- Guarantees: tool `input` follows `input_schema` (sampling is constrained to schema-valid output) and tool `name` is always one of the provided tools.
- Schema rules (skill reference, structured outputs section): every object needs `additionalProperties: false`; supported: basic types, `enum`, `const`, `anyOf`, `allOf`, `$ref`/`$defs`, string formats (`date-time`, `uri`, `email`, `uuid`, ...). Not supported: recursive schemas, `minimum`/`maximum`/`multipleOf`, `minLength`/`maxLength`, complex array constraints (so `maxItems: 10` must be enforced in our code). The TS SDK strips unsupported constraints in its helpers and checks them client-side.
- New schemas have a one-time compile cost; compiled schemas are cached 24 hours.
- Incompatible with citations (400) and message prefilling.
- With `stop_reason: "refusal"` or `"max_tokens"` the output may not match the schema.
- Strict output is still **untrusted model output**: a valid string can be `../netlify.toml`. Validate paths with the allow-list (`path-allowlist` skill) at propose and approve time.

## The loop (manual, streamed)

1. `client.messages.stream({... tools, tool_choice: {type:"auto"} })`, then `await stream.finalMessage()`.
2. `stop_reason === "tool_use"`: append `{role:"assistant", content: message.content}` (whole content).
3. For each `tool_use` block run the tool; collect `{type:"tool_result", tool_use_id, content}`; on failure add `is_error: true` with a useful message so Claude can recover.
4. Send all results in **one** `user` message. Repeat until `end_turn`.
5. Stop (do not run tools) on `refusal`, or on `max_tokens` when a `tool_use` is present.

The SDK also has a beta tool runner (`client.beta.messages.toolRunner`, `betaZodTool`, `betaTool`). The skill reference prefers it in general, but notes a manual loop is fine when you need control. For the console, a manual single-turn-per-request design fits the 60 s Function limit and the human approval gate, so we keep the manual loop.

## Our tools (docs/04-agent-console.md)

| Tool | Does | Never |
|---|---|---|
| `read_file(path)` | GitHub contents GET, read allow-list | write |
| `list_files(prefix)` | GitHub trees GET | write |
| `propose_change({summary, files:[{path, content}]})` | validate + store pending proposal in Blobs | commit |

Example definition and validation: `examples/02-propose-change-tool/propose-turn.mjs` (verified against a mock).

## Prompting tools on current models

The prompting best-practices page warns current models may *over*-trigger tools when prompts shout ("CRITICAL: You MUST use this tool"). Use plain wording: "Use propose_change when you want to change a file."
