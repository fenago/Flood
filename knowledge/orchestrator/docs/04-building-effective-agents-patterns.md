Source: https://www.anthropic.com/engineering/building-effective-agents
Retrieved: 2026-11-26

# Workflow patterns from "Building effective agents" (Anthropic)

Authors: Erik S. and Barry Zhang. Published 2024-12-19 (page metadata; URL now redirects to `/research/building-effective-agents`).

## 1. Workflows vs agents

- **Workflows**: "LLMs and tools are orchestrated through predefined code paths."
- **Agents**: "LLMs dynamically direct their own processes and tool usage".
- Our team is mixed: the wave structure is a workflow; each expert is an agent inside its task.

## 2. Start simple

> "we recommend finding the simplest solution possible, and only increasing complexity when needed."

> "add multi-step agentic systems only when simpler solutions fall short."

Orchestrator rule: if one expert can do it, send it to one expert. Do not create waves for a one-line change.

## 3. The five patterns and how we use them

| Pattern | Definition (short) | Flood Watch use |
|---|---|---|
| Prompt chaining | Steps in sequence, each uses the previous output; add "gates" between steps | Waves: design -> build -> review -> test -> sign-off, with acceptance criteria as gates |
| Routing | Classify input, send to a specialised handler | Choosing the owner for each task from the roster |
| Parallelization - sectioning | Independent subtasks run at once | All tasks in one wave launched in one message |
| Parallelization - voting | Same task run several times for confidence | Rare; e.g. two independent reviews of a risky allow-list change (security-engineer + qa-engineer security tests) |
| Orchestrator-workers | A central LLM "dynamically breaks down tasks, delegates them to worker LLMs, and synthesizes their results" | The orchestrator itself |
| Evaluator-optimizer | One LLM generates, another evaluates in a loop | Build -> security/QA review -> fix loop |

### Orchestrator-workers vs parallelization

> "the key difference from parallelization is its flexibility - subtasks aren't pre-defined, but determined by the orchestrator based on the specific input."

Fits coding work where "the number of files that need to be changed and the nature of the change in each file likely depend on the task". So: the orchestrator writes a new plan per goal; there is no fixed task list.

### Evaluator-optimizer fit test

Works when there are clear evaluation criteria and when feedback demonstrably improves the output. Our acceptance criteria and the release checklist are those criteria. Cap the loop (e.g. two fix rounds) and escalate to the owner after that.

## 4. Three principles for agents

1. Keep the design **simple**.
2. Prioritise **transparency** "by explicitly showing the agent's planning steps" - the orchestrator always shows the plan (waves, owners, dependencies) before launching.
3. Craft the agent-computer interface through good tool **documentation and testing** - for us: clear brief and report formats, and `agent-builder` evals.

## 5. Stopping conditions and human checkpoints

> "Agents can then pause for human feedback at checkpoints or when encountering blockers ... it's also common to include stopping conditions (such as a maximum number of iterations) to maintain control."

Checkpoints in our process:
- Owner approves the plan for anything touching Functions, auth, secrets or the allow-list.
- Owner approves every commit (fixed decision 5).
- Release sign-off is GO/NO-GO, never "probably fine".
- Max two review-fix rounds per task before escalating.
