---
name: pwa-manifest-service-worker
description: Maintain the Flood Watch web app manifest, icons and service worker so the app installs and works offline. Use when changing manifest.webmanifest, icons, sw.js or caching strategy.
user-invocable: false
---
# Manifest and service worker

Manifest (`public/manifest.webmanifest`, linked with `<link rel="manifest">`): `id`, `name`, `short_name`, `start_url`, `scope`, `display: "standalone"`, `background_color`, `theme_color`, icons 192 and 512 PNG plus a 512 `maskable`, `screenshots` (narrow). No `prefer_related_applications: true`. Also `apple-touch-icon` 180 px and `<meta name="theme-color">`.

Service worker (`public/sw.js`, served `Cache-Control: no-cache`):
- `install`: pre-cache app shell into `shell-v<N>`; bump N whenever shell files change.
- `activate`: delete caches not in the current version list; `clients.claim()`.
- `fetch`: shell → cache-first; Open-Meteo/NOAA/NWS → network-first with cache fallback + `fetchedAt`; `/api/*` and `/console/*` → network only.
- Updates: when a new worker is waiting, show "Update available — Reload" and `postMessage({type:"SKIP_WAITING"})` on tap.

Chrome needs HTTPS + the manifest members above to install; a fetch handler is no longer required but we keep one for offline.
