Source: https://www.anthropic.com/engineering/multi-agent-research-system
Retrieved: 2026-11-26

# Lessons from "How we built our multi-agent research system" (Anthropic)

Authors: Jeremy Hadfield, Barry Zhang, Kenneth Lien, Florian Scholz, Jeremy Fox, Daniel Ford. Published 2025-06-13 (page metadata; the URL now redirects to `/research/multi-agent-research-system`).

## 1. Architecture

- "an orchestrator-worker pattern, where a lead agent coordinates the process while delegating to specialized subagents that operate in parallel."
- This is exactly our shape: orchestrator = lead; the 11 experts = workers.

## 2. What every delegation must contain

> "Each subagent needs an objective, an output format, guidance on the tools and sources to use, and clear task boundaries."

Our brief template maps to it:

| Article | Flood Watch brief field |
|---|---|
| Objective | Goal + acceptance criteria |
| Output format | The Result / Checks / Handoff / Risks report |
| Tools and sources | "Read first" docs list, skills to apply |
| Task boundaries | Files the expert owns for this task; what is out of scope |

Vague briefs cause duplicated work and gaps between workers (the article reports subagents repeating each other's searches when briefs were short).

## 3. Scale effort to the task

- "Simple fact-finding requires just 1 agent with 3-10 tool calls"
- "direct comparisons might need 2-4 subagents with 10-15 calls each"
- "complex research might use more than 10 subagents with clearly divided responsibilities."

For us: a one-file fix goes straight to one expert; a feature uses 3-6 experts per wave; never launch an expert with nothing concrete to own.

## 4. Parallelism

- Two kinds: the lead "spins up 3-5 subagents in parallel rather than serially", and subagents use "3+ tools in parallel".
- Result: "cut research time by up to 90% for complex queries".

## 5. Cost

- "agents typically use about 4x more tokens than chat interactions, and multi-agent systems use about 15x more tokens than chats."
- Multi-agent (Opus 4 lead + Sonnet 4 workers) "outperformed single-agent Claude Opus 4 by 90.2%" on their internal research eval.
- Implication: use the team only where the value justifies ~15x tokens.

## 6. When multi-agent is a poor fit

> "some domains that require all agents to share the same context or involve many dependencies between agents are not a good fit ... most coding tasks involve fewer truly parallelizable tasks than research"

For a coding project this means: parallelise across clearly separate files/modules (scoring vs API client vs CSS tokens), and sequence anything that touches the same file or contract. Fix the contract first (architect), then build both sides in parallel.

## 7. Synchronous waves

- "our lead agents execute subagents synchronously, waiting for each set of subagents to complete before proceeding. This simplifies coordination, but creates bottlenecks".
- We accept this trade-off: wave-by-wave is simpler to audit and fits human approval.

## 8. Avoid the "game of telephone"

- "Subagents call tools to store their work in external systems, then pass lightweight references back to the coordinator."
- For us: experts write their output to files in the repo (or a named scratch path) and report the paths. The orchestrator passes paths, plus only the excerpts the next expert needs, rather than re-typing large outputs.

## 9. Evaluation

- Start small: "a set of about 20 queries representing real usage patterns."
- LLM-as-judge with a rubric scales; "Human evaluation catches what automation misses".
- `agent-builder` owns agent evals; the orchestrator supplies real tasks from past waves as eval cases.

## 10. Reliability

- Errors compound; "we can't just restart from the beginning ... we built systems that can resume from where the agent was".
- They use "rainbow deployments" so running agents are not broken by updates.
- For us: resume a failed expert with its ID rather than relaunching the whole wave; record wave state (which tasks done) in the plan file.
