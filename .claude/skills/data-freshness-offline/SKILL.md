---
name: data-freshness-offline
description: Cache forecast data safely for offline use in Flood Watch and always show its age. Use when changing fetch, caching, or offline behaviour for weather, tide or alert data.
user-invocable: false
---
# Data freshness and offline

- Forecast/tide/alert requests: network-first, cache fallback. Store `fetchedAt` with every cached response.
- UI always shows "Updated 10:05 am" and, when offline or older than 3 h, a clear banner: "Offline — forecast from 3 h ago. Check NWS for current alerts."
- Never present cached **alerts** as current; if alert data is older than 30 min, say "Alert status unknown".
- Refresh on app open, on `visibilitychange` to visible, and when back online; debounce to ≥ 10 min per city.
- Cache at most the last 12 cities; evict oldest.
- Agent Console and `/api/*` responses are never cached.
