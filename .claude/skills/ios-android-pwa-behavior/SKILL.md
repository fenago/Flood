---
name: ios-android-pwa-behavior
description: Handle the differences between iPhone and Android for the Flood Watch PWA - install flow, standalone mode, safe areas, push and background limits. Use when building install prompts or platform-specific behaviour.
user-invocable: false
---
# iPhone vs Android

| | Android Chrome | iPhone/iPad |
|---|---|---|
| Install | `beforeinstallprompt` → our "Install" button calls `prompt()` | Safari: Page Menu (…) → Share → Add to Home Screen → turn on "Open as Web App" → Add (iOS 16.4+ also Chrome, Edge, Firefox, Orion; menus differ). No prompt event. |
| Detect installed | `matchMedia('(display-mode: standalone)')` | same, plus `navigator.standalone` |
| Web Push | yes | only for Home Screen apps, iOS 16.4+, after a user tap |
| Background Sync | Chromium only | no |

- iOS: show a one-time, dismissible install sheet with the steps above in words (name the Share button; the menu layout varies with Safari's tab layout; if Add to Home Screen is missing: Edit Actions). Say "Open as Web App" must be on for full-screen mode. No copied Apple Share glyph. Never nag. Source: `knowledge/ux-designer-apple-hig/docs/06-ios-home-screen-install.md`.
- Use `viewport-fit=cover` and `env(safe-area-inset-*)` so content clears the notch and home bar.
- Safari (iOS and macOS) does not support `prefers-reduced-transparency`; default styles must be readable without it (see `liquid-glass-visual-design`).
- Test standalone mode on real devices; iOS storage can be evicted — the app must survive an empty cache.
- Capacitor only if we need store listing, background location or widgets (see `docs/02-pwa-installability.md`).
