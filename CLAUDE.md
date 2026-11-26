# Flood Watch — project guide for Claude

Flood Watch is a mobile-first, installable web app (a PWA) for South Florida. A user picks a city and sees:

- a **flood prognosis** (Low / Elevated / High / Severe) with reasons, and
- a **beach-day score** (0–100).

The owner also gets a password-protected **Agent Console**, where the agents below can chat and propose code changes. A change is committed to GitHub only after the owner clicks Approve; the commit then redeploys the site on Netlify.

## Fixed decisions (do not change without the owner)

1. It is a PWA on Netlify: a static front end plus Netlify Functions. Functions handle only the Claude API and GitHub calls (and the console's auth). The only storage is Netlify Blobs. **There are no other servers, databases or hosts.**
2. The browser calls Open-Meteo, NOAA and NWS directly. Open-Meteo is free, needs no key, is non-commercial only, and requires the credit line "Weather data by Open-Meteo.com".
3. Official National Weather Service alerts override our scores. The app is not an official warning service and always says so.
4. Secrets (Claude key, GitHub token, password hash, session secret) live only in Netlify environment variables scoped to Functions. They never go in the browser, the repo or logs.
5. Console agents can only *propose* changes. A human approves every commit. Proposals may only touch allow-listed paths, and `.claude/`, `netlify/`, `netlify.toml`, `.github/`, `scripts/` and `package*.json` are always denied.

## The team

The experts are project subagents in `.claude/agents/`. Their knowledge is in project skills in `.claude/skills/<skill>/SKILL.md`. Each agent's `skills:` field preloads the full text of its skills when it starts. Roles and skill sharing are defined in `docs/expert-roster.md`.

| Agent | Job |
|---|---|
| `orchestrator` | Leads the team: plans, runs experts in parallel, routes all handoffs, signs off releases |
| `agent-builder` | Meta agent: builds, evaluates and improves the agents and skills |
| `software-architect` | System design within the static + Functions + Blobs constraint |
| `api-integration-open-meteo` | Open-Meteo, NOAA tides and NWS alerts clients, caching, attribution |
| `flood-risk-scientist` | Flood and beach scoring, thresholds, calibration, honest uncertainty |
| `pwa-mobile-engineer` | Front-end code, manifest, service worker, iPhone/Android behaviour |
| `ux-designer-apple-hig` (Wren) | Flows, screens, wording, accessibility (Apple HIG) |
| `ui-designer-apple-liquid-glass` (Sable) | Visual design in a Liquid Glass style, design tokens |
| `agent-console-engineer` | Console Functions: Claude API, proposals, GitHub commits |
| `security-engineer` | Auth, secrets, token, allow-list, CSP, rate limits; reviews sensitive changes |
| `netlify-engineer` | netlify.toml, builds, env vars, Blobs, deploys, rollback |
| `qa-engineer` | All testing, release evidence, post-deploy smoke tests |

## How the team works

- **The orchestrator runs the experts in parallel.** It splits a goal into tasks with one owner each and groups independent tasks into waves. It launches every task in a wave together (one Agent call per expert in a single message) and waits only when a later task needs an earlier result.
- **Agents hand work to each other through the orchestrator.** Every expert has `disallowedTools: Agent`, so it cannot start another agent. Each expert ends its work with a report whose **Handoff** section says what another expert must do next. The orchestrator turns those items into tasks for the next wave and passes along the output they need.
- Any change to Functions, auth, secrets, CSP, `netlify.toml` or the allow-list is reviewed by `security-engineer`. Every release candidate is tested by `qa-engineer` before the orchestrator signs it off.
- To work as the team, start a session with the orchestrator as the main agent:

  ```bash
  claude --agent orchestrator
  ```

  Or, in a normal session, ask Claude to "use the orchestrator" for anything that needs more than one expert. When the orchestrator runs as a subagent, it still launches experts one level below itself, within Claude Code's nesting limit.
- For a single-expert task (for example, "fix the manifest icons"), delegate directly to that expert.

## Where things are

- `docs/README.md` is the research index. Read the topic doc before working in an area.
  - `docs/01-use-case-and-scoring.md`: APIs, field names, scoring
  - `docs/02-pwa-installability.md`
  - `docs/03-architecture.md`
  - `docs/04-agent-console.md`
  - `docs/05-testing-and-accessibility.md`
  - `docs/expert-roster.md`
- Record design decisions in `docs/decisions.md`.
- Agent and skill files follow the official Claude Code formats (https://code.claude.com/docs/en/sub-agents, https://code.claude.com/docs/en/skills). Change them through `agent-builder`. The extra `personality:` frontmatter field is for the Agent Console cards; Claude Code ignores it.

## Working rules

- Keep changes small, tested and documented. Update the matching doc in the same change.
- Never commit secrets or `.env` files. Never weaken a security control or skip a test to get a green build.
- Cite official documentation for any external limit, field name or threshold.
