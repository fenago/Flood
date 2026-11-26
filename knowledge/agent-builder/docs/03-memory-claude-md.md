Source: https://code.claude.com/docs/en/memory
Source: https://code.claude.com/docs/en/sub-agents
Retrieved: 2026-11-26

# CLAUDE.md and memory

## Instruction files and load order (broad -> specific)

| Scope | Path |
|---|---|
| Managed policy | Linux/WSL `/etc/claude-code/CLAUDE.md`; macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`; Windows `C:\Program Files\ClaudeCode\CLAUDE.md` |
| User | `~/.claude/CLAUDE.md` |
| Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` (or `./AGENTS.md` depending on configuration) |
| Local (private) | `./CLAUDE.local.md` - add to `.gitignore` |

- CLAUDE.md / CLAUDE.local.md in **subdirectories** load on demand when Claude reads, writes or edits a file in that subdirectory.
- `claudeMdExcludes` setting skips specific ancestor CLAUDE.md files (path or glob) - useful in monorepos.

## Imports and rules

- Import another file with `@path/to/file`; imports can nest up to **four hops**.
- `.claude/rules/*.md` splits instructions into modules; a rule can be scoped to files with a `paths:` list in its frontmatter.

## Size

- Target **under 200 lines** per CLAUDE.md. Our `CLAUDE.md` is the team map; put detail in `docs/`, skills and knowledge folders.

## Auto memory

- When on, Claude loads the first **200 lines or 25 KB** (whichever first) of `MEMORY.md` at session start.
- `/memory` lists the loaded files, toggles auto memory, opens the folder. `/init` drafts a CLAUDE.md from the codebase.

## Subagents and memory

- The main conversation's **auto memory is not loaded into subagents** (a fork is the exception: it inherits the parent context).
- A subagent can have its own persistent memory with frontmatter `memory: user | project | local`; that loads the first 200 lines / 25 KB of its `MEMORY.md` and auto-enables Read, Write and Edit (sub-agents page).
- Subagents load project CLAUDE.md by default; `omitClaudeMd: true` turns that off (except managed policy files).
- Project decision: our experts do **not** use `memory:`. Durable knowledge lives in reviewed files (`knowledge/<agent>/`, skills, `docs/`) so every change goes through a human commit. Adding `memory:` would also grant Write/Edit, which the console agents must not have. Raise it with `security-engineer` before ever adding it.

## How this applies to Flood Watch

| Need | Put it in |
|---|---|
| Team-wide fixed decisions, roster, where things are | `CLAUDE.md` (keep < 200 lines) |
| One agent's role and rules | `.claude/agents/<name>.md` body |
| Reusable how-to rules for a topic | `.claude/skills/<skill>/SKILL.md` (< 500 lines, preloaded) |
| Long reference notes with sources | `knowledge/<agent>/docs/` |
| Design decisions | `docs/decisions.md` |

Changes to `.claude/**` and `CLAUDE.md` are on the console deny-list: they are committed by a human, never through a console proposal.
