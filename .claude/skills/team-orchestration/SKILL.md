---
name: team-orchestration
description: Break an owner goal into expert tasks, run independent tasks in parallel, sequence dependent ones, and route every handoff between Flood Watch agents. Use when planning or coordinating work across more than one expert.
user-invocable: false
---
# Team orchestration

## Plan
1. Restate the goal in one sentence and list acceptance criteria.
2. Split it into tasks that each have exactly one owner from `docs/expert-roster.md`.
3. Mark dependencies. Tasks with no dependency between them form one **wave**.
4. Route anything touching auth, secrets, tokens, the allow-list, CSP or Functions through `security-engineer` before it ships.

## Run
- Launch every task in a wave **in the same message** (one Agent call per expert) so they run in parallel. Never run a wave one agent at a time.
- Give each expert a self-contained brief: goal, files to read (`docs/…`), files it owns for this task, acceptance criteria, and what to return.
- Wait for the whole wave, then read every expert's **Handoff** section before starting the next wave.

## Route handoffs
- Experts never call each other. When a report says "needs X from <agent>", you create that task for <agent> in the next wave with the relevant output pasted in.
- If two experts disagree, decide using the docs and the fixed decisions in `CLAUDE.md`. Record the decision in `docs/decisions.md`.

## Close
Summarise for the owner: what changed, which files, tests run and results, open risks, and what needs their approval.
