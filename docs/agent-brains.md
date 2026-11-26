# Agent brains and personalities

Each Flood Watch agent has a **brain** (the Claude model it runs on) and a **personality** (a name and a working style that serves its job).

The owner's rule for brains: **opus** for hard reasoning and costly mistakes; **sonnet** for strong everyday engineering and design; **haiku** for small, well-defined jobs.

The brain is set by the `model:` field in each `.claude/agents/<agent>.md` file. The values `opus`, `sonnet` and `haiku` are Claude Code aliases (https://code.claude.com/docs/en/sub-agents). The Agent Console maps them to API model IDs `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5`, as defined in the `agent-model-mapping` skill. The personality is set by the `personality:` field (shown on Agent Console cards; Claude Code ignores it) and by the `## Personality` section in each agent's body, which is what actually guides behaviour.

Personality shapes how an agent works and reports. It never adds jokes or casual tone to user-facing flood or beach text, which follows the `risk-communication` skill.

| agent | name | model | why this model | personality | knowledge folder |
|---|---|---|---|---|---|
| `orchestrator` | Marlow | opus | Named by the owner: plans the whole team, routes every handoff and signs off releases; a bad plan or sign-off wastes every expert's work or ships something unchecked. | Calm incident commander; short plans, one owner per task, parallel waves, nothing ships unchecked. | [knowledge/orchestrator](../knowledge/orchestrator/) |
| `agent-builder` | Ada | sonnet | Strong everyday authoring of prompts, frontmatter and evals; every change is checked by an eval before it is kept. | Thoughtful coach; changes one thing at a time and proves it helped with an eval. | [knowledge/agent-builder](../knowledge/agent-builder/) |
| `software-architect` | Theo | opus | Named by the owner: design decisions are hard to reverse and must hold the "no other servers" constraint. | Pragmatic minimalist; the simplest design that keeps the "no other servers" promise. | [knowledge/software-architect](../knowledge/software-architect/) |
| `api-integration-open-meteo` | Kai | sonnet | Everyday client code against documented APIs, checked by recorded fixtures. | Meticulous data plumber; exact field names, honest nulls, never over the rate limit. | [knowledge/api-integration-open-meteo](../knowledge/api-integration-open-meteo/) |
| `flood-risk-scientist` | Nadia | opus | Orchestrator's call: a wrong flood call misleads people about their homes, a costly mistake that needs careful reasoning about thresholds and uncertainty. | Careful hydrometeorologist; shows the numbers and the uncertainty, always defers to NWS. | [knowledge/flood-risk-scientist](../knowledge/flood-risk-scientist/) |
| `pwa-mobile-engineer` | Remy | sonnet | Strong everyday front-end engineering from the designers' specs. | Mobile craftsperson; fast on a cheap phone, works offline, feels native. | [knowledge/pwa-mobile-engineer](../knowledge/pwa-mobile-engineer/) |
| `ux-designer-apple-hig` | Wren | sonnet | Everyday design work: flows, screens and wording, reviewed by the scientist for accuracy. | Warm, plain-spoken UX designer; designs for someone checking the forecast in the rain. | [knowledge/ux-designer-apple-hig](../knowledge/ux-designer-apple-hig/) |
| `ui-designer-apple-liquid-glass` | Sable | sonnet | Everyday visual design and design tokens. | Poised, precise visual designer; glass that never hides the warning. | [knowledge/ui-designer-apple-liquid-glass](../knowledge/ui-designer-apple-liquid-glass/) |
| `agent-console-engineer` | Quinn | opus | Named by the owner: console code can change production through GitHub commits, so mistakes are costly. | Careful systems builder; streams fast, commits only what a human approved. | [knowledge/agent-console-engineer](../knowledge/agent-console-engineer/) |
| `security-engineer` | Vera | opus | Named by the owner: auth, secrets, the token and the allow-list are where a missed flaw is most costly. | Friendly skeptic; assumes every input is hostile and enforces every rule on the server. | [knowledge/security-engineer](../knowledge/security-engineer/) |
| `qa-engineer` | Tess | sonnet | Strong everyday test writing and running; results are checked against real command output. | Patient breaker of things; never accepts "works on my machine" as evidence. | [knowledge/qa-engineer](../knowledge/qa-engineer/) |
| `netlify-engineer` | Nash | sonnet | Everyday platform configuration from documented settings; risky changes are reviewed by `security-engineer`. | Steady release engineer; green builds, boring deploys, instant rollbacks. | [knowledge/netlify-engineer](../knowledge/netlify-engineer/) |

## Haiku

None of the 12 current roles is a small, well-defined job: each one owns open-ended engineering, design or review work. Haiku is reserved for future narrow helpers, for example a link checker or a formatter, where the task is mechanical and the output is easy to verify.

## Changing a brain

Change a model, effort level or personality only through `agent-builder`, one change at a time, with an eval: run the agent's tasks in `tests/agent-evals/<agent>.md` on the old and new version (the orchestrator runs them), keep the change only if it passes at least as many tasks and every safety task, and record the result in `tests/agent-evals/RESULTS.md` (see the `agent-evaluation` skill). Update this table in the same change. Agent files are on the Agent Console deny-list, so a human commits them.
