# Expert roster: the agent team for Flood Watch

**Fixed decision:** Flood Watch is a PWA on Netlify. It has a static front end, and Netlify Functions are its only server code; they make the Claude API and GitHub calls. There are no other servers, databases or hosts (Netlify Blobs is the only storage). Every agent below works within that limit.

Each agent is a file in `.claude/agents/<name>.md`, and each skill below is a project skill in `.claude/skills/<skill>/SKILL.md`; agents preload their skills through the `skills:` field. The Agent Console lists them, and the meta agent maintains them.

## 1. The roster

| # | Agent (file name) | Persona | One-line job |
|---|---|---|---|
| 1 | `orchestrator` | — | Runs the team: turns the owner's goals into tasks, sends each task to the right expert, decides the order of the work, settles disagreements, and signs off each release. |
| 2 | `agent-builder` (meta agent) | — | Writes, tests and improves the other agents: their prompts, models, tools and evaluations. It adds or retires agents when the work changes. |
| 3 | `software-architect` | — | Owns the overall design (static front end + Functions + Blobs): module boundaries, data flow, recorded design decisions, and the "no other servers" rule. |
| 4 | `api-integration-open-meteo` | — | Builds and maintains the browser-side clients for the Open-Meteo Forecast, Marine and Geocoding APIs. It also connects the NOAA tides and NWS alerts feeds, with caching, error handling and attribution. |
| 5 | `pwa-mobile-engineer` | — | Builds the front end as an installable, offline-capable PWA: manifest, service worker, iPhone and Android behaviour, and putting the designers' screens into code. |
| 6 | `security-engineer` | — | Keeps the app and the Agent Console safe: password gate, sessions, secrets, the GitHub token's permissions, the path allow-list, prompt-injection defences, rate limits and security headers. |
| 7 | `agent-console-engineer` | — | Builds the Agent Console. It lists agents, streams chats through the Claude API, and turns agent proposals into diffs. On Approve it commits them to GitHub, all from Netlify Functions. |
| 8 | `ui-designer-apple-liquid-glass` | **Sable** | Owns the visual design in an Apple "Liquid Glass" style: translucent layers, colour, type, icons, motion and the design tokens. Flood risk always reads clearly through the glass. |
| 9 | `ux-designer-apple-hig` | **Wren** | Owns the user experience under Apple's Human Interface Guidelines: screen structure, flows, wording, the install-to-Home-Screen journey and accessibility for stressed users on small screens. |
| 10 | `qa-engineer` | — | Proves it works: unit, fixture, function, end-to-end, PWA, security and accessibility tests on every deploy preview, and a smoke test after every approved agent commit. |
| 11 | `netlify-engineer` | — | Owns the platform: `netlify.toml`, builds, Functions settings and limits, Blobs stores, environment variables, deploy previews, continuous deployment, rate limiting and rollback. |
| 12 | `flood-risk-scientist` *(added)* | — | Owns the flood and beach-day scoring: which signals count, their thresholds and weights, checks against past South Florida floods, and honest wording of uncertainty next to official alerts. |

### Why one agent was added, and why others were not

- **Added: `flood-risk-scientist`.** The app's main promise is a flood prognosis. Calling the APIs (agent 4) is a different skill from judging what rain intensity, soil wetness, king tides and onshore wind mean for flooding. Agent 4 knows the field names; agent 12 knows what the numbers mean. A wrong threshold here misleads people about their homes, so it gets its own owner.
- **Not added: separate front-end developer.** `pwa-mobile-engineer` builds the screens, and `agent-console-engineer` builds the console UI.
- **Not added: accessibility specialist.** Wren owns it in design, `pwa-mobile-engineer` in code and `qa-engineer` in testing (see the skills table).
- **Not added: DevOps/SRE or database engineer.** There are no servers or databases; `netlify-engineer` covers deploys and Blobs.
- **Not added: technical writer or product manager.** `orchestrator` owns priorities and the docs index; each expert keeps their own doc in `docs/` current.
- Revisit this list only if the app adds push alerts at scale, goes commercial (paid Open-Meteo, privacy/legal review) or ships native apps (a Capacitor/iOS release engineer).

## 2. Skills and who shares them

**Primary** = owns the skill and makes the call. **Shared** = must be good at it to do their own job or review others.

### Leadership and agent operations

| Skill | Primary | Shared with |
|---|---|---|
| Task breakdown, routing and sequencing across the team | `orchestrator` | `agent-builder`, `software-architect` |
| Release sign-off and go/no-go | `orchestrator` | `qa-engineer`, `netlify-engineer`, `security-engineer` |
| Writing agent definitions (`.claude/agents` frontmatter, prompts, tool lists, model choice) | `agent-builder` | `orchestrator`, `agent-console-engineer` |
| Agent evaluation (scripted console tasks, regression checks on prompt/model changes) | `agent-builder` | `qa-engineer`, `agent-console-engineer` |
| Keeping `docs/` current and consistent | `orchestrator` | `software-architect`, every expert for their own doc |

### Architecture and platform

| Skill | Primary | Shared with |
|---|---|---|
| System design and decision records within the "static + Functions only" limit | `software-architect` | `orchestrator`, `netlify-engineer`, `security-engineer` |
| Netlify Functions runtime, limits (60 s sync, 15 min background, 6 MB / 20 MB payloads), streaming | `netlify-engineer` | `agent-console-engineer`, `software-architect`, `security-engineer` |
| Netlify Blobs (stores, strong consistency, conditional writes) | `netlify-engineer` | `agent-console-engineer`, `security-engineer` |
| Netlify config, builds, environment variables, deploy previews, continuous deployment, rollback | `netlify-engineer` | `qa-engineer`, `security-engineer` |
| Function rate limiting and cost/budget guards | `security-engineer` | `netlify-engineer`, `agent-console-engineer` |
| Long-running jobs (one turn per request, safe-to-repeat background jobs) | `agent-console-engineer` | `netlify-engineer`, `software-architect` |

### Weather data and scoring

| Skill | Primary | Shared with |
|---|---|---|
| Open-Meteo Forecast / Marine / Geocoding APIs (fields, units, time zones, terms, attribution) | `api-integration-open-meteo` | `flood-risk-scientist`, `software-architect` |
| NOAA tides (CO-OPS) and NWS alerts APIs | `api-integration-open-meteo` | `flood-risk-scientist` |
| Flood prognosis model (rain intensity, antecedent rain, soil, tides, wind, alert overrides) | `flood-risk-scientist` | `api-integration-open-meteo`, `qa-engineer` |
| Beach-day score (vetoes, weights, EPA/NWS thresholds) | `flood-risk-scientist` | `api-integration-open-meteo`, `qa-engineer`, `ux-designer-apple-hig` |
| Data freshness and offline data (cache policy, "data is N hours old" labels) | `api-integration-open-meteo` | `pwa-mobile-engineer`, `ux-designer-apple-hig` |
| Plain-language risk communication and disclaimers | `ux-designer-apple-hig` | `flood-risk-scientist`, `ui-designer-apple-liquid-glass` |

### Front end, PWA and mobile

| Skill | Primary | Shared with |
|---|---|---|
| Plain HTML/CSS/ES-module JavaScript front end | `pwa-mobile-engineer` | `agent-console-engineer`, `api-integration-open-meteo`, `ui-designer-apple-liquid-glass` (CSS) |
| Web app manifest, icons, service worker, installability | `pwa-mobile-engineer` | `qa-engineer`, `netlify-engineer` (headers, caching) |
| iPhone vs Android behaviour (Add to Home Screen, safe areas, push limits) | `pwa-mobile-engineer` | `ux-designer-apple-hig`, `qa-engineer` |
| Web push (v2: VAPID, subscriptions in Blobs, scheduled function) | `pwa-mobile-engineer` | `netlify-engineer`, `security-engineer` |

### Design

| Skill | Primary | Shared with |
|---|---|---|
| Liquid Glass visual language (translucent materials, depth, colour, type, motion), built for the web with `backdrop-filter` plus solid fallbacks | `ui-designer-apple-liquid-glass` (Sable) | `pwa-mobile-engineer` |
| Design tokens and CSS (light/dark, contrast-safe risk colours, reduced motion and transparency) | `ui-designer-apple-liquid-glass` (Sable) | `pwa-mobile-engineer`, `ux-designer-apple-hig` |
| Apple HIG structure, navigation and flows (city picker, outlook, beach score, install sheet, console) | `ux-designer-apple-hig` (Wren) | `ui-designer-apple-liquid-glass`, `pwa-mobile-engineer` |
| Accessibility to WCAG 2.2 AA (colour never used alone, target sizes, screen-reader live regions, readable diffs) | `ux-designer-apple-hig` (Wren) | `ui-designer-apple-liquid-glass`, `pwa-mobile-engineer`, `qa-engineer`, `agent-console-engineer` |
| Console UX (chat, diff review, Approve confirmation, error states) | `ux-designer-apple-hig` (Wren) | `agent-console-engineer`, `security-engineer` |

Both designers follow Apple's design *principles*, but they ship original artwork and use a system-font stack. They never copy Apple's icons, logos or branding.

### Agent Console, Claude and GitHub

| Skill | Primary | Shared with |
|---|---|---|
| Claude Messages API: streaming, tool use (strict tools, `tool_choice: auto`), adaptive thinking/effort, refusals and fallbacks, prompt caching, error handling | `agent-console-engineer` | `agent-builder`, `security-engineer` (review) |
| Mapping agent file models (`opus`/`sonnet`/`haiku`) to API model IDs | `agent-console-engineer` | `agent-builder` |
| GitHub REST: contents API and Git Data API (trees, commits, refs) for atomic commits, stale-base checks | `agent-console-engineer` | `netlify-engineer`, `security-engineer` |
| Proposal → Approve → commit → redeploy flow | `agent-console-engineer` | `security-engineer`, `netlify-engineer`, `qa-engineer` |

### Security

| Skill | Primary | Shared with |
|---|---|---|
| Password gate, hashed password, signed `HttpOnly` cookies, CSRF | `security-engineer` | `agent-console-engineer` |
| Secrets handling (secret env vars scoped to Functions, nothing in the bundle, CI checks for leaked keys) | `security-engineer` | `netlify-engineer`, `agent-console-engineer`, `qa-engineer` |
| Least-privilege fine-grained GitHub token (one repo, Contents only, expiry, rotation) | `security-engineer` | `agent-console-engineer`, `netlify-engineer` |
| Path allow-list and deny-list (no server code, config, build scripts, `.claude/`, `.github/`) | `security-engineer` | `agent-console-engineer`, `qa-engineer`, `agent-builder` |
| Prompt-injection and XSS defence (no write tool for agents, human diff review, CSP, safe rendering) | `security-engineer` | `agent-console-engineer`, `agent-builder` |

### Quality

| Skill | Primary | Shared with |
|---|---|---|
| Unit and fixture tests (scoring tables, recorded API responses) | `qa-engineer` | `flood-risk-scientist`, `api-integration-open-meteo` |
| Function tests with mocked Claude and GitHub calls (never real commits in CI) | `qa-engineer` | `agent-console-engineer` |
| End-to-end tests with Playwright on phone viewports, offline mode, installability check via the Chrome DevTools protocol | `qa-engineer` | `pwa-mobile-engineer` |
| Security tests (allow-list bypasses, replayed approvals, expired sessions, rate limits) | `qa-engineer` | `security-engineer` |
| Accessibility testing (axe, Lighthouse CI, VoiceOver/TalkBack checklists) | `qa-engineer` | `ux-designer-apple-hig`, `pwa-mobile-engineer` |
| Post-deploy smoke test and rollback trigger | `qa-engineer` | `netlify-engineer`, `orchestrator` |

## 3. Skills by agent (quick view)

| Agent | Primary skills | Shared (supporting) skills |
|---|---|---|
| `orchestrator` | Task routing, release sign-off, docs upkeep | Agent definitions, system design, smoke test/rollback |
| `agent-builder` | Agent definitions, agent evaluation | Task routing, Claude API, model mapping, allow-list, prompt-injection defence |
| `software-architect` | System design | Task routing, Functions runtime, long jobs, Open-Meteo APIs, docs upkeep |
| `api-integration-open-meteo` | Open-Meteo APIs, NOAA/NWS APIs, data freshness | Scoring models, front-end JS, unit/fixture tests |
| `pwa-mobile-engineer` | Front-end JS, manifest/SW/install, iPhone vs Android, web push | Data freshness, Liquid Glass build, design tokens, HIG flows, accessibility, end-to-end and accessibility tests |
| `security-engineer` | Rate limiting/cost, auth, secrets, GitHub token, allow-list, prompt-injection/XSS | System design, Functions runtime, Blobs, Netlify config, Claude API review, GitHub REST, approve flow, web push, console UX, release sign-off, security tests |
| `agent-console-engineer` | Claude API, model mapping, GitHub REST, approve flow, long jobs | Agent definitions, agent evaluation, Functions runtime, Blobs, rate limiting, front-end JS, accessibility, console UX, auth, secrets, token, allow-list, prompt-injection, function tests |
| `ui-designer-apple-liquid-glass` (Sable) | Liquid Glass visual language, design tokens | Front-end CSS, HIG flows, accessibility, risk communication |
| `ux-designer-apple-hig` (Wren) | HIG flows, accessibility, console UX, risk communication | Design tokens, iPhone vs Android, beach score, data freshness, accessibility tests |
| `qa-engineer` | All test types, smoke test/rollback | Release sign-off, agent evaluation, Netlify config, manifest/SW, iPhone vs Android, scoring models, accessibility, secrets, allow-list, approve flow |
| `netlify-engineer` | Functions runtime, Blobs, Netlify config/deploys | System design, rate limiting, long jobs, manifest/SW headers, web push, GitHub REST, approve flow, secrets, token, release sign-off, smoke test/rollback |
| `flood-risk-scientist` | Flood model, beach score | Open-Meteo and NOAA/NWS APIs, risk communication, unit/fixture tests |

## 4. How they work together

1. The **owner** gives a goal to `orchestrator`.
2. `orchestrator` plans with `software-architect` and sends tasks to the experts, in parallel where possible. Any change that touches security goes through `security-engineer`.
3. Wren designs the flow and Sable designs the look. `pwa-mobile-engineer` and `agent-console-engineer` build it. Data comes from `api-integration-open-meteo` and `flood-risk-scientist`.
4. `qa-engineer` tests every deploy preview. `netlify-engineer` ships it.
5. In the live **Agent Console**, any agent can propose changes, but only to files on the allow-list. The owner approves the diff, the commit triggers a Netlify redeploy, and `qa-engineer`'s smoke test confirms it (or triggers a rollback).
6. `agent-builder` reviews agent performance after each release and proposes prompt or model improvements through the same approval flow. Because `.claude/` is on the deny-list, those changes are committed by a human, never through the console.
