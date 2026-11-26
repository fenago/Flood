---
name: agent-model-mapping
description: Map model aliases in .claude/agents files to Claude API model IDs for the Agent Console, with an allow-list. Use when loading agent definitions or adding a model.
user-invocable: false
---
# Agent model mapping

| Frontmatter `model` | API model ID |
|---|---|
| `opus`, `inherit`, missing | `claude-opus-5-5` |
| `sonnet` | `claude-sonnet-5-5` |
| `haiku` | `claude-haiku-5-5` |
| `fable` | `claude-fable-5-2` |
| full ID | allowed only if in `ALLOWED_MODELS` |

- Keep the table in one module (`netlify/functions/lib/models.mjs`); unknown values fall back to `claude-opus-5-5` and log a warning.
- `effort` frontmatter (`low`…`max`) maps to `output_config.effort`; default `medium` for chat, `high` for code-writing agents.
- Build step `scripts/build-agents-manifest.mjs` writes `public/console/agents.json` with `name, description, model, personality` only.
