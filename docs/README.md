# Flood Watch — research docs

Research for a mobile-friendly, installable web app (PWA) on Netlify that shows a **flood prognosis** and a **beach-day score** for South Florida cities, plus an **Agent Console** where AI agents from `.claude/agents/` can chat and propose code changes that ship only after the owner clicks Approve.

This folder is the shared context for the team of expert agents that will build the app. Read the README, then the file for your area.

| # | File | Covers |
|---|---|---|
| 1 | [01-use-case-and-scoring.md](01-use-case-and-scoring.md) | The use case, South Florida cities, Open-Meteo Forecast/Marine/Flood APIs (exact field names), NOAA/NWS sources, flood score and beach-day score with sourced thresholds, API terms |
| 2 | [02-pwa-installability.md](02-pwa-installability.md) | Install requirements on Android and iPhone, manifest, service worker plan, push, when to use Capacitor |
| 3 | [03-architecture.md](03-architecture.md) | Static site + Netlify Functions, repo layout, Netlify limits (60 s / 15 min / 6 MB / 20 MB), Blobs, env vars, `netlify.toml`, deploy flow |
| 4 | [04-agent-console.md](04-agent-console.md) | Listing agents, Claude API usage, propose → approve → commit → redeploy, password gate, fine-grained token, path allow-list, long jobs |
| 5 | [05-testing-and-accessibility.md](05-testing-and-accessibility.md) | Test layers, PWA checks after Lighthouse dropped its PWA category, security tests, WCAG 2.2 AA plan |

## Key decisions at a glance

1. **The browser calls Open-Meteo directly.** Open-Meteo's terms say apps hosted on Netlify may hit per-IP rate limits early; calling from each phone avoids that. Free tier: non-commercial, < 10,000 calls/day, CC BY 4.0 attribution.
2. **Official alerts win.** NWS flood/coastal alerts override our computed score; the app is not a warning system and says so.
3. **Open-Meteo sea level is a trend, not a street-level depth.** The Marine API docs say coastal accuracy is limited and inland values may be unreliable; use NOAA tide predictions (Virginia Key 8723214) for tide timing.
4. **PWA first, Capacitor later only if needed** (background location alerts, store listing, widgets).
5. **Functions only for secrets and writes.** Claude key, GitHub token and password hash live in Functions-scoped secret env vars; nothing secret ships to the browser.
6. **Agents can only *propose*.** A human approves a diff; the approve function re-checks a path allow-list that excludes server code, config, build scripts, `.claude/` and `.github/`; the commit triggers Netlify's redeploy.
7. **Long jobs:** one Claude turn per request (under the 60 s sync limit), background functions (15 min, retried, so idempotent) for big tasks, with state in Netlify Blobs.

## Open questions for the owner

- Commit approved changes straight to `main`, or to a branch + PR with a Deploy Preview first? (Docs recommend starting with the branch + PR flow.)
- Should the app ever be commercial (ads, subscriptions)? That would require Open-Meteo's paid API.
- Do we want push alerts in v1? On iPhone they only work after "Add to Home Screen".
- Which cities beyond the starter list (e.g. Naples, Fort Myers on the Gulf coast)?

## Items marked "(verify)"

A few details could not be fully confirmed from the docs pages and should be checked in a short spike: NWS Surf Zone Forecast endpoint format, Lake Worth tide station ID, whether the 60 s limit applies unchanged to streamed responses, whether Claude Code tolerates the custom `personality` frontmatter key, and current iOS install behaviour.
