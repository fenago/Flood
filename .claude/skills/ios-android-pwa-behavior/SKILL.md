---
name: ios-android-pwa-behavior
description: Handle the differences between iPhone and Android for the Flood Watch PWA - install flow, standalone mode, safe areas, push and background limits. Use when building install prompts or platform-specific behaviour.
user-invocable: false
---
# iPhone vs Android

| | Android Chrome | iPhone/iPad |
|---|---|---|
| Install | `beforeinstallprompt` → our "Install" button calls `prompt()` | Share → Add to Home Screen (iOS 16.4+: Safari, Chrome, Edge, Firefox, Orion). No prompt event. |
| Detect installed | `matchMedia('(display-mode: standalone)')` | same, plus `navigator.standalone` |
| Web Push | yes | only for Home Screen apps, iOS 16.4+, after a user tap |
| Background Sync | Chromium only | no |

- iOS: show a one-time, dismissible install sheet with the Share icon and steps; never nag.
- Use `viewport-fit=cover` and `env(safe-area-inset-*)` so content clears the notch and home bar.
- Test standalone mode on real devices; iOS storage can be evicted — the app must survive an empty cache.
- Capacitor only if we need store listing, background location or widgets (see `docs/02-pwa-installability.md`).
