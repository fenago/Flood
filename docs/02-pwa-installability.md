# 02 · Making it installable (PWA) and when to go native

## 1. Minimum to be installable

Per MDN, Chromium browsers (Chrome, Edge, Samsung Internet) require:

- Served over **HTTPS** (or `localhost` in development). Netlify provides HTTPS automatically.
- A web app manifest linked from every page: `<link rel="manifest" href="/manifest.webmanifest">`
- Manifest members: `name` or `short_name`; `icons` with a **192 px and a 512 px** icon; `start_url`; `display` (or `display_override`); `prefer_related_applications` absent or `false`.

A service worker is **not** strictly required for installation any more: Chrome 108 (Android) and 112 (desktop) dropped the `fetch`-handler requirement for installing from the browser menu. We still want one, for offline forecasts.

### Recommended manifest

```json
{
  "id": "/",
  "name": "Flood Watch South Florida",
  "short_name": "Flood Watch",
  "description": "Flood outlook and beach-day score for South Florida cities.",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0b1d2a",
  "theme_color": "#0b1d2a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/screens/phone-1.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow" }
  ]
}
```

Also add `<meta name="theme-color">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">` (iOS uses this icon), and `viewport-fit=cover` with CSS `env(safe-area-inset-*)` so content clears the iPhone notch and home bar.

## 2. Android vs iPhone

| | Android (Chrome) | iPhone / iPad |
|---|---|---|
| How users install | Install prompt / menu "Install app". We can show our own button via the `beforeinstallprompt` event and call `prompt()`. | **Share → Add to Home Screen.** No `beforeinstallprompt`. Since iOS 16.4 this works from Safari, Chrome, Edge, Firefox and Orion (MDN). |
| Opens as app | Yes, with `display: standalone` | Yes, if the manifest sets `display` to `standalone`/`fullscreen` (WebKit). Recent Safari releases have relaxed install requirements further **(verify on current iOS)**. |
| Web Push | Yes | Yes, **only for Home Screen web apps**, iOS 16.4+, after a user gesture asks permission (Apple/WebKit docs). |
| Background Sync / Periodic Sync | Chromium only | Not supported |
| Install UI in our app | Custom "Install" button | Show a one-time instructional sheet ("Tap Share, then Add to Home Screen") when `navigator.standalone` is false on iOS |

Firefox on Android adds a browser-badged shortcut rather than a manifest-based install (MDN).

## 3. Service worker plan

- **App shell** (HTML/CSS/JS/icons/cities.json): pre-cache on `install`, versioned cache name, delete old caches on `activate`.
- **Forecast API calls** (Open-Meteo, NOAA, NWS): *network-first with cache fallback*, and store the fetch timestamp so the UI can say "Offline — showing forecast from 3 h ago". Never present a stale flood forecast as current.
- **Agent Console and `/api/*`**: never cache (authenticated, dynamic).
- Update flow: when a new service worker is waiting, show "Update available — reload". This matters because approved agent commits redeploy the site frequently.
- Tooling: hand-written SW is fine for this size; Workbox is the common library if the team prefers.

## 4. Notifications (nice-to-have)

"Alert me when my city goes to High" needs Web Push: a VAPID key pair (private key in a Netlify env var), a subscription stored in Netlify Blobs, and a **scheduled** Netlify Function that checks forecasts and sends pushes. Works on Android and on iOS only after the user installs to the Home Screen. Treat it as v2.

## 5. When you would need a native wrapper (Capacitor)

Stay a PWA unless one of these becomes a hard requirement:

| Need | PWA | Capacitor (native shell around the same web code) |
|---|---|---|
| App Store / Play Store listing and discovery | No (Play Store possible via a TWA) | Yes |
| Reliable background location ("alert me where I am now") | No | Yes, via native plugins |
| Critical / time-sensitive alerts that bypass Focus, guaranteed delivery | Limited; iOS push needs Home Screen install | Native push (APNs/FCM) |
| Home-screen widgets, Siri/Shortcuts, Apple Watch | No | Yes, with native code |
| Background refresh while app is closed on iOS | No | Yes (limited by iOS scheduling) |

Capacitor documents first-class PWA support: the same web codebase can ship to the web *and* to iOS/Android, so starting as a PWA does not paint us into a corner. Costs of going native: Apple Developer Program fee, store review, and a second release pipeline (store updates are not instant like Netlify deploys — and approved agent commits would no longer reach phone users immediately).

**Recommendation:** v1 is a PWA. Revisit Capacitor only if users demand location-based push alerts on iPhone without installing to the Home Screen.

## Sources

- MDN, Making PWAs installable — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- MDN, Offline and background operation — https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- Chrome, Revisiting installability criteria — https://developer.chrome.com/blog/update-install-criteria
- WebKit, Web Push for Web Apps on iOS and iPadOS — https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Apple, Sending web push notifications in web apps and browsers — https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- Capacitor, Building Progressive Web Apps — https://capacitorjs.com/docs/web/progressive-web-apps
