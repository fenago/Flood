Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt
Source: https://web.dev/learn/pwa/installation-prompt
Source: https://developer.chrome.com/blog/update-install-criteria
Retrieved: 2026-11-26

# Installability and the install prompt

## Chromium installability criteria (MDN, page modified 2026-10-06)
Chromium browsers (Chrome, Edge, Samsung Internet) require a linked manifest with:
- `name` **or** `short_name`
- `icons` containing a **192px and a 512px** icon
- `start_url`
- `display` and/or `display_override`
- `prefer_related_applications` absent or `false`

Plus transport: served over `https`, or from `localhost` / `127.0.0.1` (any port). This is
stricter than "secure context": `file://` does **not** count.

### Service worker requirement (Chrome blog)
- Chrome removed the "service worker with a `fetch()` handler" requirement for installing
  **from the browser menu** "since version 108 on mobile and 112 on Desktop".
- The same post says: "For now the algorithm that displays the install prompt still requires the
  presence of a `fetch()` handler". So keep our SW `fetch` handler — it also gives us offline.
  (Whether this caveat still holds in current Chrome: (unconfirmed) — the post is undated in our read.)

## Browser support (MDN)
- Desktop: Chromium installs manifest apps on all desktop OSes; Safari 17+ (macOS Sonoma) has
  File → Add to Dock for any site; Firefox desktop does not install manifest PWAs.
- Android: only Chrome (with Google Mobile Services) and Samsung Internet (on Samsung devices)
  install real **WebAPKs** (launcher, app switcher, system settings). Firefox, Edge, Opera, and
  Chrome without GMS add a browser-badged home-screen shortcut instead.
- iOS ≤ 16.3: Safari only. iOS 16.4+: Share menu → Add to Home Screen in Safari, Chrome, Edge,
  Firefox and Orion.
- Chrome (desktop + Android), Safari desktop and Edge desktop also let users install **any**
  site; the manifest is what makes the browser actively promote it.
- `description` and `screenshots` are shown in the install prompt **on Android only**.

## In-app install button (Chromium only)
`beforeinstallprompt` is "non-standard and currently only implemented in Chromium-based browsers"
(MDN). Not in Firefox or Safari; "not supported on iOS".

Pattern (MDN, matches `../examples/app/install.js`):
1. Render an Install button with `hidden`.
2. `window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; button.hidden = false; })`
   — `preventDefault()` suppresses Chrome's mini-infobar on mobile (web.dev).
3. On click: `const { outcome } = await deferred.prompt();` → `'accepted'` or `'dismissed'`.
   (web.dev reads the same outcome from `deferred.userChoice`.)
4. Then clear it: "The deferredPrompt can only be used once" (web.dev). Hide the button.
5. `window.addEventListener('appinstalled', ...)` → clear and hide as well.

If the event never fires (unsupported browser, already installed, criteria not met) there is
**no other way** to open the browser's install dialog from script (web.dev).

## Where to promote install (web.dev)
- Common places: side menu, after a key journey completes, after sign-up.
- Show install UI **only in browser mode**: use `@media (display-mode: browser)` or hide it under
  `@media (display-mode: standalone)` — standalone/fullscreen means it is already installed.
- For Flood Watch (our decision): show the button after the first successful outlook render,
  never as a blocking modal; iOS gets the instructional sheet once (doc 05).

## Testing notes
- Headless Chromium will not fire a real `beforeinstallprompt`; test the wiring with a
  synthetic event that has a stub `prompt()` (done in `../examples/verify.mjs`).
- Check installability with CDP `Page.getInstallabilityErrors` in **full** Chromium
  (`channel: 'chromium'`) with a **persistent** profile. Observed 2026-11-26 (Playwright 1.63):
  the default headless shell returned `[]` even with no manifest, and an incognito
  `newContext()` always adds `in-incognito`. Details: qa-engineer knowledge doc 06.
- Real-device check each release: Android Chrome install from the menu and our button.
