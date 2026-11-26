# Decisions log

Format: date · decision · why · alternatives rejected · owner.

## Decided

| Date | Decision | Why | Rejected | Owner |
|---|---|---|---|---|
| 2026-11-26 | Flood Watch is a PWA on Netlify: static front end, Netlify Functions only for Claude/GitHub (and console auth), Netlify Blobs only storage, no other servers. | Owner decision; simplest secure hosting. | Separate backend server, database, native app first. | Owner |
| 2026-11-26 | The browser calls Open-Meteo directly. | Open-Meteo limits per IP and warns that Netlify-hosted callers get rate-limited early ([terms](https://open-meteo.com/en/terms)). | Proxying through Functions. | software-architect |
| 2026-11-26 | Netlify code-based rate-limit rules only on `auth-login` and `agent-chat`; all other endpoints use a per-IP counter in Blobs; the login lockout counter is required. | Netlify allows 2 rules per project on Free/Personal and 5 on Pro, and blocking can take ~10 s to start (`knowledge/netlify-engineer/docs/05-headers-and-rate-limiting.md`). | Netlify rules on all ~8 endpoints (does not fit any plan). | security-engineer, netlify-engineer |
| 2026-11-26 | CSRF uses a signed double-submit token bound to the session, plus Origin / Sec-Fetch-Site checks; session cookie `__Host-fw_session`. | OWASP calls the naive double-submit pattern insecure (`knowledge/security-engineer/docs/03-csrf-prevention.md`). | Naive double-submit cookie. | security-engineer |
| 2026-11-26 | Every Function sets its own security headers via a shared helper. | `netlify.toml` headers do not apply to Function responses. | Relying on `[[headers]]` only. | netlify-engineer |
| 2026-11-26 | `knowledge/**`, `public/_headers` and `public/_redirects` join the console's path deny-list. | Knowledge folders steer agent behaviour; `_headers`/`_redirects` are Netlify config in the publish folder. | Leaving them only implicitly blocked. | security-engineer |
| 2026-11-26 | Liquid Glass is used only on the navigation/control layer; risk cards are solid; default glass is ~86–88% opaque. | Apple HIG says not to use Liquid Glass in the content layer; iPhone Safari ignores `prefers-reduced-transparency`. | Glass risk cards. | ui-designer-apple-liquid-glass |
| 2026-11-26 | Agent models: opus for orchestrator, architect, security, agent-console and flood-risk scientist; sonnet for the rest; haiku reserved for future narrow helpers. | Owner rule: opus for hard reasoning and costly mistakes, sonnet for everyday engineering and design, haiku for small well-defined jobs. See `docs/agent-brains.md`. | — | Owner, orchestrator |

## Open — need the owner

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Which Netlify plan? | Free / Personal / Pro | Per-variable "Functions only" env scopes need Pro; secret values and scanning need Personal or above. Recommend at least Personal; Pro if you want scoped secrets. |
| 2 | NWS alerts: browser direct or via a Function? | Browser direct (matches `CLAUDE.md` decision 2) / small `alerts` proxy Function with caching | Browser direct if browser requests work without a custom `User-Agent` (unconfirmed); otherwise a proxy, which needs a change to decision 2. |
| 3 | Deploy Previews share site-wide Blobs with production. | Key prefix per deploy context / previews read-only / separate site for previews | Key prefix per context. |
| 4 | Scoring gaps found with real Flood Watch data (2026-11-25). | (a) add WMO code 97 "heavy thunderstorm" to the beach veto; (b) cap the beach score on heavy rain all day; (c) use the NWS heat index computed from temperature and humidity instead of `apparent_temperature`; (d) label model rain totals as estimates; (e) new NWS override floors for Storm Surge, Hurricane and Tropical Storm alerts. | All five, reviewed by flood-risk-scientist with fixture tests (`knowledge/flood-risk-scientist/examples/`). |
