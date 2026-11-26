# agent-builder: worked examples

| File | Runnable | Shows |
|---|---|---|
| `validate-agents.mjs` | yes | Parses `.claude/agents/*.md` and `.claude/skills/*/SKILL.md` frontmatter (js-yaml) and checks fields, allowed values and wiring. ERROR = would break or silently disable something; WARN = project convention or size limit; INFO = unused skill. Exit code 1 on any ERROR. |
| `model-files/claude/agents/beach-copywriter.md` | via validator | A model agent file: required fields, alias model, effort, color, `disallowedTools: Agent`, one preloaded skill, "Before you answer", reasons in the rules, report format with Handoff. (Fixture only - not a real agent.) |
| `model-files/claude/skills/beach-wording/SKILL.md` | via validator | A model background skill: `name` = directory, job-first description, `user-invocable: false`, short imperative rules. |
| `model-files/knowledge/beach-copywriter/README.md` | - | Minimal knowledge folder so the fixture passes the knowledge-folder check. |
| `eval-task-agent-console-engineer.md` | no | An eval task file in the `tests/agent-evals/<agent>.md` format. |

Why `model-files/claude/` and not `.claude/`: Claude Code loads nested `<subdir>/.claude/skills/` as real skills once it works on files there. The validator takes the config folder name as a second argument.

## How to run

Install `js-yaml` somewhere outside the repo root (see `package.json`), then link this folder next to that `node_modules`:

```bash
W=/path/to/scratch   # contains node_modules/js-yaml
ln -sfn "$PWD" "$W/ab" && cd "$W"
node --preserve-symlinks --preserve-symlinks-main ab/validate-agents.mjs /home/user/Flood
node --preserve-symlinks --preserve-symlinks-main ab/validate-agents.mjs ab/model-files claude
```

## Verified (2026-11-26, Node v22.23.5, js-yaml 5.5.0)

- **Real repo** - `node --preserve-symlinks --preserve-symlinks-main ab/validate-agents.mjs /home/user/Flood`
  Output: `agents: 12, skills: 41, skills preloaded somewhere: 41`, `ERRORS: 0`, exit 0. WARNs only for `knowledge/<agent>/README.md` folders not yet created at run time (other agents' folders were being written in parallel; 9 on the first run, 6 on the second). All 12 agents have a single "Before you answer" section pointing at their own folder; every `skills:` entry resolves; no skill sets `disable-model-invocation`; every expert except `orchestrator` has `disallowedTools: Agent`.
- **Model files** - `node --preserve-symlinks --preserve-symlinks-main ab/validate-agents.mjs ab/model-files claude`
  Output: `agents: 1, skills: 1`, `ERRORS: 0`, `WARNS: 0`, `INFOS: 0`, exit 0.
- **Negative check** (a scratch copy of model-files with `disallowedTools` removed, `color: teal`, an extra skill `no-such-skill`, and `disable-model-invocation: true` on the skill)
  Output: `ERRORS: 4` - bad color, skill cannot be preloaded, missing skill, missing `disallowedTools: Agent`; exit 1.

Not verified: that Claude Code itself loads the model files (the validator encodes the documented rules; it does not run Claude Code). The eval task file has not been run against an agent.
