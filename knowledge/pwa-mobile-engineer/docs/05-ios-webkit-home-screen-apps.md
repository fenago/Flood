Source: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
Source: https://web.dev/learn/pwa/installation-prompt
Source: https://web.dev/learn/pwa/update
Retrieved: 2026-11-26

# iPhone / iPad: Home Screen web apps

## What makes a site a Home Screen web app (WebKit blog, iOS/iPadOS 16.4, Feb 2023)
- The user adds it with **Share → Add to Home Screen**. If the site serves a manifest with
  `display` set to `standalone` or `fullscreen`, "that site becomes a Home Screen web app".
- Since 16.4, third-party browsers can offer Add to Home Screen from their Share menu
  (MDN names Safari, Chrome, Edge, Firefox, Orion). Before 16.4: Safari only.
- 16.4 added support for the manifest `id` member (MDN compat: Safari on iOS 16.4).
- If no icon is provided, iOS 16.4 generates a **monogram** icon (first letter of the name + a
  site colour). We always ship `apple-touch-icon` and manifest icons so this never happens.

## No install prompt on iOS
- There is no `beforeinstallprompt` on iOS (MDN: "This is not supported on iOS").
- web.dev: on platforms where users install manually, like iOS, show instructions instead, and
  "only render these instructions in browser mode" — `standalone`/`fullscreen` means installed.
- Flood Watch: one-time, dismissible sheet "Tap the Share button, then Add to Home Screen";
  store the dismissal (wrapped in try/catch, storage may be unavailable); never nag.

## Detecting iOS and standalone (implementation notes)
```js
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
            (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); // iPadOS desktop UA
```
`navigator.standalone` is a non-standard Apple property; it is not described on the pages above —
(unconfirmed) against an Apple/WebKit reference in this pass. Use `display-mode` first.

## Web Push on iOS (WebKit blog)
- Only for web apps **added to the Home Screen**, iOS/iPadOS 16.4+.
- Permission may only be requested "in response to direct user interaction — such as tapping on a
  'subscribe' button provided by the web app". Never on page load.
- Uses standard Push API + Notifications API + service worker; integrates with **Focus**; users
  manage permission per app in **Settings → Notifications**.
- Badging API: `navigator.setAppBadge(n)` / `clearAppBadge()` work in Home Screen apps, in the
  foreground or while handling a push, "even before permission to display the count has been granted".
- Other 16.4 additions listed: Screen Wake Lock, Screen Orientation, User Activation API, Web Codecs video.

## Updates and storage on iOS
- Manifest metadata (name, icons, start_url) on iOS/iPadOS only updates by **re-installing** the
  app (web.dev "Update"). Get them right before launch.
- Background Sync / Periodic Background Sync: not supported on iOS (our `docs/02`; not re-verified
  on a WebKit page in this pass — (unconfirmed)).
- iOS can evict website storage; the app must render a sensible first-run state with an empty cache
  (skill rule; the specific eviction policy was not checked here — (unconfirmed)).

## Real-device checklist (each release)
- [ ] Safari: Share → Add to Home Screen shows our icon and "Flood Watch".
- [ ] Launch from Home Screen opens standalone (no Safari UI); install sheet does not appear.
- [ ] Notch / Dynamic Island and home indicator do not cover content (doc 06 safe areas).
- [ ] Airplane mode: cached outlook with age banner appears.
- [ ] (v2) Push permission prompt only after tapping our button.
Automation cannot do these: Playwright's `devices['iPhone 15']` emulates viewport/UA/touch in
WebKit, but not Home Screen install, push or the real notch.
