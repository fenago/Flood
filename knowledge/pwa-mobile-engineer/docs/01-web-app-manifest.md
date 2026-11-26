Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id
Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons
Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display
Retrieved: 2026-11-26

# Web app manifest — members and deployment

## Deploying the file
- Link it from the `<head>` of **every** page: `<link rel="manifest" href="/manifest.webmanifest">`.
- The spec registers the `.webmanifest` extension; serve it as `Content-Type: application/manifest+json`.
  Browsers "generally support" `.json` / `application/json` too (MDN).
- If the manifest fetch needs credentials, add `crossorigin="use-credentials"` to the link, even
  same-origin. Flood Watch's manifest is public, so we do not need this.
- Netlify note (ours, not MDN): make sure `netlify.toml` / `_headers` does not serve it with a
  wrong type; the example server in `../examples/serve.mjs` sets the type explicitly.

## Members MDN lists (status as shown on the MDN index, 2026-11-26)
Standard / not marked experimental: `background_color`, `description`, `display`, `icons`, `id`,
`name`, `orientation`, `scope`, `short_name`, `shortcuts`, `start_url`, `theme_color`.
Listed without a flag: `categories`, `screenshots` (`*_localized` is experimental in the compat table).
Marked experimental: `display_override`, `file_handlers`, `launch_handler`, `note_taking`,
`prefer_related_applications`, `protocol_handlers`, `related_applications`, `scope_extensions`,
`share_target`. `serviceworker` is experimental **and** non-standard.

Flood Watch uses only: `id`, `name`, `short_name`, `description`, `start_url`, `scope`, `display`,
`background_color`, `theme_color`, `icons`, `screenshots`. Do not add `prefer_related_applications: true`
(it blocks Chromium installability — see doc 02).

## `id` — the app's identity (do not change it after launch)
- A URL string; must be same-origin with `start_url`. A relative `id` resolves against the
  **origin** of `start_url` (not its path), so `foo`, `/foo`, `./foo`, `../foo` all give `https://origin/foo`.
- Missing, empty or invalid (cross-origin, not a string) → falls back to `start_url`.
- Fragments are stripped (`foo#x` → `foo`); query strings are kept.
- MDN recommends a leading `/` (root-relative).
- Same `id` + different `start_url` → browser treats it as an **update** of the installed app.
  Different `id` → a **different app** (both can be installed side by side).
- Why it matters for us: our `start_url` is `/?source=pwa`. Without `"id": "/"` the identity would be
  `https://<site>/?source=pwa`; changing the query later would create a "new" app. Keep `"id": "/"`.
- Support (MDN compat table): Chrome/Edge 96, Safari 17, Safari on iOS 16.4, Samsung 17; Firefox no.

## `icons`
Each entry: `src` (required), `sizes` (`"WxH"`, space-separated list allowed), `type`
(`image/<subtype>`), `purpose`.
- `purpose` keywords (case-sensitive, space-separated, default `any`):
  - `any` — usable in any context.
  - `maskable` — designed with the safe zone in mind; anything outside may be cropped.
  - `monochrome` — browser discards colour and uses only the alpha channel as a mask.
- Chromium installability needs a **192 px and a 512 px** icon (doc 02).
- We ship `icon-192.png`, `icon-512.png` (purpose `any`) and a separate `maskable-512.png`.
  Combining `"any maskable"` in one entry is allowed but makes the padded icon appear where
  `any` is used (web.dev, doc 06) — keep them separate.

## `display`
| value | meaning |
|---|---|
| `fullscreen` | whole display, browser UI hidden |
| `standalone` | looks like a native app; own window/launcher icon; no URL bar (status bar may remain) |
| `minimal-ui` | app-like but with minimal navigation controls (back/reload, maybe URL) |
| `browser` | normal tab/window — **the default** |

Fallback chain if unsupported: `fullscreen` → `standalone` → `minimal-ui` → `browser`.
`display_override` (experimental) lets you redefine that order. We use `standalone`.
WebKit requires `standalone` or `fullscreen` for an iOS Home Screen web app (doc 05).

## Our manifest (verified in `../examples/app/manifest.webmanifest`)
```json
{ "id": "/", "name": "Flood Watch South Florida", "short_name": "Flood Watch",
  "start_url": "/?source=pwa", "scope": "/", "display": "standalone",
  "background_color": "#0b1d2a", "theme_color": "#0b1d2a",
  "icons": [ {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
             {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
             {"src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"} ] }
```
Also in `<head>`: `<meta name="theme-color">` and `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`
(apple-touch-icon is Apple convention; 180 px size is from our docs/02, not re-checked on an Apple page — (unconfirmed)).

## Checklist when editing the manifest
- [ ] `id` unchanged. [ ] 192 + 512 icons still present and the files exist (404 icon = install error).
- [ ] `start_url` inside `scope`. [ ] Served as `application/manifest+json`.
- [ ] Run the example verifier pattern: CDP `Page.getAppManifest` has `errors: []` and
      `Page.getInstallabilityErrors` is `[]` in full Chromium (see qa-engineer knowledge, doc 06).
