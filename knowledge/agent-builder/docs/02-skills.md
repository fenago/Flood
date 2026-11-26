Source: https://code.claude.com/docs/en/skills
Source: https://code.claude.com/docs/en/sub-agents
Retrieved: 2026-11-26

# Claude Code skills (`.claude/skills/<name>/SKILL.md`)

A skill is a directory with a `SKILL.md` (YAML frontmatter + Markdown instructions) and optional supporting files (reference docs, scripts, examples).

## Frontmatter fields

| Field | Notes |
|---|---|
| `name` | Command name in the `/` menu. **Defaults to the directory name.** Project rule: set it and keep it equal to the directory. Allowed characters/length: (unconfirmed on the page we read; we use lowercase-hyphen, <= 64). |
| `description` | Recommended. What it does and when to use it; Claude uses it to decide when to apply the skill. If missing, the first non-empty body line is used. **Put the key use case first.** |
| `when_to_use` | Extra trigger phrases; appended to `description` in the listing. |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]`. |
| `arguments` | Named positional args for `$name` substitution. |
| `disable-model-invocation` | `true` = only the user can run it (`/name`). Description is **not** in context. Also **blocks preloading into subagents**. Default `false`. |
| `user-invocable` | `false` = hidden from `/` menu; only Claude invokes it. Use for background knowledge. Default `true`. |
| `allowed-tools` | Tools usable without asking during the invoking turn. |
| `disallowed-tools` | Tools removed while the skill is active. |
| `model` | Model for the turn when run with `/name` (or `inherit`). |
| `effort` | `low` ... `max` for the rest of the turn (or the forked agent with `context: fork`). |
| `context` | `fork` = run in a forked subagent. `agent` picks the subagent type; `background` (default `true`) applies with fork. |
| `hooks`, `paths`, `shell` | Hooks while invoked; glob patterns that activate the skill; `bash` (default) or `powershell` for `!` command blocks. |
| `metadata`, `license`, `compatibility` | Accepted, not acted on (`compatibility` <= 500 chars). |

## Invocation control

| Frontmatter | User can invoke | Claude can invoke | In context |
|---|---|---|---|
| (default) | yes | yes | description always; full text when invoked |
| `disable-model-invocation: true` | yes | no | description not in context |
| `user-invocable: false` | no | yes | description always; full text when invoked |

Our skills are background knowledge preloaded by agents, so they use `user-invocable: false` and must **never** set `disable-model-invocation: true`.

## Size limits that matter

- Listing cap: `description` + `when_to_use` truncated at **1,536 characters** (setting `skillListingMaxDescChars`).
- Whole skill listing budget: about **1%** of the model's context window (`skillListingBudgetFraction` / `SLASH_COMMAND_TOOL_CHAR_BUDGET`).
- Keep `SKILL.md` under **500 lines**; move long reference text into sibling files and link them.
- After auto-compaction, invoked skills are re-attached: first **5,000 tokens** of each, **25,000 tokens** combined.
- Preloading into a subagent injects the full skill text (see `01-subagents.md`); only the first 32 distinct skills load.

## Locations and precedence

Enterprise (managed) > personal `~/.claude/skills/` > project `.claude/skills/`. Also nested `<subdir>/.claude/skills/` (loads for sessions in or below that subdir, or once Claude works on files there), `--add-dir` directories, plugins (`/plugin:skill`), and claude.ai account skills. A skill beats a `.claude/commands/` file of the same name.

Consequence for us: never put an example `.claude/skills/` folder inside `knowledge/` - it could load as a real nested skill. Our fixture uses `examples/model-files/claude/` instead.

## Substitutions in skill content

`$ARGUMENTS`, `$ARGUMENTS[N]` / `$N`, `$name`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}` (plugin skills also `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`).

## Writing a good project skill

- Description: job first, then "Use when ...". One sentence each.
- Body: short imperative rules, concrete names and numbers, pointer to the doc or knowledge file with the detail.
- One owner skill per topic; share by listing it in several agents' `skills:` rather than copying text.
- Example that passes validation: `examples/model-files/claude/skills/beach-wording/SKILL.md`.
