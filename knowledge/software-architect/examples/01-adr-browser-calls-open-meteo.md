# Example 1 - ADR in `docs/decisions.md` style

Format from `../docs/06-architecture-decision-records.md` (Nygard + the `docs-upkeep` fields).

---

## ADR-001: Browser calls Open-Meteo directly, not via Netlify Functions

- Date: 2026-11-26
- Status: accepted (restates CLAUDE.md fixed decision 2)
- Owner: `software-architect`
- Deciders consulted: `api-integration-open-meteo`, `netlify-engineer`, `security-engineer`

### Context

Flood Watch needs hourly forecast, marine and geocoding data from Open-Meteo for every outlook. The app is a static PWA on Netlify; Netlify Functions exist only for the Claude API, GitHub and console auth.

Open-Meteo's free tier is for non-commercial use and allows "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute". Its terms say "Rate limits are applied by IP addresses and application. If you are using providers like Vercel, Netlify, Render, or Google Sheets you might be rate-limited earlier then expected." It reserves the right to block misusing IP addresses without notice. Open-Meteo needs no API key, so there is no secret to protect.

A Netlify Function proxy would make every user's request leave from Netlify's shared egress addresses, which other Netlify sites also use. It would also add an invocation per outlook view, a 60-second-limited hop, and a second place to cache.

The browser can call Open-Meteo directly: the endpoints are HTTPS and keyless, the service worker can cache responses for offline use, and the Content-Security-Policy can list the exact hosts.

### Decision

We will call `api.open-meteo.com`, `marine-api.open-meteo.com` and `geocoding-api.open-meteo.com` from the browser (`src/api/open-meteo.js`). We will batch all cities into one request using comma-separated coordinates, cache results in the browser with a `fetchedAt` time, and show the data age. We will list only these hosts (plus NOAA and NWS) in `connect-src`. We will show `Weather data by Open-Meteo.com` as a link next to every place Open-Meteo data appear, as the licence requires.

### Alternatives rejected

| Option | Why rejected |
|---|---|
| Netlify Function proxy with Blobs cache | Shared Netlify IPs risk early rate limiting; extra invocations and cost; adds server code for no secret |
| Scheduled Function that pre-fetches all cities into Blobs | Same IP problem; 30 s scheduled limit; data staler than on-demand; more moving parts |
| Cloudflare Worker proxy (suggested in Open-Meteo terms) | Adds another host and provider; breaks fixed decision 1 ("no other servers") |
| Paid Open-Meteo API key via Function | Only needed for commercial use or higher volume; would need a secret and a Function; revisit if the app becomes commercial |

### Consequences

- Positive: load spreads across user IPs; no Function cost or 60 s limit for weather; works offline from the service worker cache; no secret involved.
- Negative: the per-"application" limit still covers all users together (unconfirmed how Open-Meteo identifies an application, likely by Origin/Referer); a viral spike could hit 10,000/day. Mitigation: batching, cache-first for 30-60 minutes, and a visible stale-data label instead of retry loops.
- Negative: we cannot add server-side logging or fallback for Open-Meteo failures; the UI must handle errors and `null` values itself.
- Neutral: CSP must change whenever a data host changes; that change goes through `security-engineer`.
- Follow-up: if the owner ever adds ads or subscriptions, free use ends ("Private or non-profit websites or apps that do not have subscriptions or advertising" are the non-commercial examples); write a superseding ADR.

### Sources

- https://open-meteo.com/en/terms
- https://open-meteo.com/en/licence
- https://docs.netlify.com/build/functions/configuration/ (60 s sync, 30 s scheduled limits)
