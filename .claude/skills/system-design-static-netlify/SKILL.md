---
name: system-design-static-netlify
description: Design rules for Flood Watch - a static PWA front end plus Netlify Functions and Netlify Blobs, with no other servers. Use when deciding where code, data or a new feature should live.
user-invocable: false
---
# System design: static + Functions only

Fixed decision: static front end on Netlify's CDN, Netlify Functions only for Claude and GitHub calls (plus auth, NWS proxy, push), Netlify Blobs as the only storage. No other servers, databases, containers or hosts.

## Where things go
| Need | Put it in |
|---|---|
| Weather/marine/tide data | Browser calls Open-Meteo and NOAA directly (per-user IP; Open-Meteo warns Netlify IPs get rate-limited) |
| Secret key or write to GitHub | Netlify Function under `/api/*` |
| State (sessions, chats, jobs, proposals, counters) | Netlify Blobs, site-wide store |
| Scoring weights | `public/config/scoring.json` |
| Work longer than 60 s | Background Function (15 min) or one-turn-per-request loop |

## Reject
Any design that needs another host, a database, WebSockets server, or a secret in the browser. Propose an alternative within the rules instead.

## Record
Every architectural choice goes in `docs/decisions.md`. Read `docs/03-architecture.md` before changing structure.
