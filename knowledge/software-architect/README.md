# Knowledge: software-architect

Reference notes and worked examples for the `software-architect` agent (`.claude/agents/software-architect.md`). They back its skills `system-design-static-netlify`, `netlify-functions-runtime`, `long-running-agent-jobs`, `open-meteo-apis` and `docs-upkeep` with facts from official pages.

Last verified: 2026-11-26

## docs/

| File | One line |
|---|---|
| [docs/01-netlify-static-deploys-cdn.md](docs/01-netlify-static-deploys-cdn.md) | Atomic deploys on the CDN, deploy contexts, preview and permalink URLs, rollback, skew protection |
| [docs/02-netlify-functions.md](docs/02-netlify-functions.md) | Handler and context API, config fields, limits table (60 s / 15 min / 6 MB / 20 MB / 256 KB), streaming, background retries |
| [docs/03-netlify-blobs.md](docs/03-netlify-blobs.md) | Site-wide vs deploy stores, key and size limits, eventual vs strong consistency, conditional writes, store/key plan |
| [docs/04-env-vars-and-rate-limiting.md](docs/04-env-vars-and-rate-limiting.md) | Env var scopes and contexts, `netlify.toml` not visible to functions, 4 KB limit, rate-limit config and per-plan rule counts |
| [docs/05-pwa-and-open-meteo-constraints.md](docs/05-pwa-and-open-meteo-constraints.md) | MDN PWA structure and installability; Open-Meteo limits, per-IP note about Netlify, attribution |
| [docs/06-architecture-decision-records.md](docs/06-architecture-decision-records.md) | Nygard's ADR format and our `docs/decisions.md` template |

## examples/

| File | One line |
|---|---|
| [examples/README.md](examples/README.md) | Index, how to run the validator, results |
| [examples/01-adr-browser-calls-open-meteo.md](examples/01-adr-browser-calls-open-meteo.md) | Filled-in ADR: browser calls Open-Meteo directly |
| [examples/02-agent-chat-interface-spec.md](examples/02-agent-chat-interface-spec.md) | Build-both-sides spec for `POST /api/agent-chat` |
| [examples/agent-chat.schema.json](examples/agent-chat.schema.json) | JSON Schema for the spec |
| [examples/payloads/](examples/payloads/) | Valid/invalid cases and two SSE transcripts |
| [examples/validate-agent-chat.mjs](examples/validate-agent-chat.mjs) | Ajv strict validator for schema and payloads |
| [examples/03-module-map.md](examples/03-module-map.md) | Module map of `src/` and `netlify/functions/` with import rules |

## Key facts at a glance

- Sync and **streamed** functions: 60 s limit (streaming confirmed on the Functions API page - resolves the "(verify)" in docs/03-architecture.md). Background: 15 min, empty 202, retries after 1 and 2 min, 256 KB payload.
- Blobs: site-wide stores persist across deploys and are shared by all deploy contexts; strong consistency is opt-in; `onlyIfNew` / `onlyIfMatch` return `{modified, etag}`.
- `netlify.toml` environment variables are not available to functions; Functions-only scoping needs the Pro plan.
- Netlify rate limiting: window <= 180 s, 429 or rewrite, not in `netlify.toml`, and only **2 rules per project on Free/Personal, 5 on Pro**.
- Open-Meteo limits by IP and application and warns Netlify-hosted callers; browser-direct calls avoid it. Credit link next to every place data appear.

## Findings that contradict current repo docs (route via orchestrator)

1. Rate-limit rule count vs the 8-endpoint plan in docs/04-agent-console.md and the `rate-limiting-cost-guards` skill.
2. docs/03-architecture.md shows an `alerts` NWS-proxy Function and `NWS_USER_AGENT`; CLAUDE.md fixed decision 2 says the browser calls NWS directly.
3. Functions-only env var scopes are a Pro-plan feature; the plan assumption is not written down.

## Unconfirmed items

- `Netlify.env.get()` (used in our skills) was not shown on the pages read; `process.env` is documented.
- Whether each function's `rateLimit` counts as one of the per-project rules.
- How Open-Meteo identifies an "application" for its limits.
- Blobs operation rate/cost limits; Node.js default-version rule details.
