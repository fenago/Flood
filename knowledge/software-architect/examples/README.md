# Software-architect examples

| File | Shows |
|---|---|
| [01-adr-browser-calls-open-meteo.md](01-adr-browser-calls-open-meteo.md) | A complete ADR in `docs/decisions.md` style with cited context, rejected alternatives and honest consequences |
| [02-agent-chat-interface-spec.md](02-agent-chat-interface-spec.md) | Interface spec for `POST /api/agent-chat`: request, SSE events, errors, Blobs keys, server steps |
| [agent-chat.schema.json](agent-chat.schema.json) | JSON Schema (draft 2020-12) for request, SSE events, error body and Blobs chat record |
| [payloads/cases.json](payloads/cases.json) | 15 valid and invalid payloads with the expected outcome |
| [payloads/turn-tool-use.sse](payloads/turn-tool-use.sse) | A full SSE turn ending in `tool_use` -> `continue` |
| [payloads/turn-proposal.sse](payloads/turn-proposal.sse) | A full SSE turn that stores a proposal and ends `end_turn` |
| [validate-agent-chat.mjs](validate-agent-chat.mjs) | Compiles the schema in Ajv strict mode, checks every case and both SSE transcripts |
| [03-module-map.md](03-module-map.md) | Module map of `src/` and `netlify/functions/` with import rules and findings to route |

## Running the validator

Ajv is not a repo dependency (no root `package.json`). Install it outside the repo:

```bash
mkdir -p /tmp/ajv && (cd /tmp/ajv && npm init -y >/dev/null && npm i ajv@8)
AJV_DIR=/tmp/ajv node knowledge/software-architect/examples/validate-agent-chat.mjs
```

Result on 2026-11-26 (Node 22.23.5, ajv 8.20.0): schema compiled in strict mode; 15/15 cases matched their expected outcome (6 valid, 9 correctly rejected for the intended reason); both SSE transcripts valid and correctly ordered; `ALL PASSED`, exit 0.

Strict mode caught three schema mistakes during writing (nested `if` without `type`, and `required` keys not declared under `then`/`items`); they are fixed.
