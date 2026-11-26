Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/What_is_a_progressive_web_app
Source: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
Source: https://open-meteo.com/en/terms
Source: https://open-meteo.com/en/licence
Retrieved: 2026-11-26

# Client-side constraints: PWA structure and Open-Meteo terms

## Part A - PWA architecture (MDN)

### What a PWA is

- "an app that's built using web platform technologies, but that provides a user experience like that of a platform-specific app."
- PWAs "are, as a matter of technology, still websites" run by a browser engine.

### Technical parts

- At least one HTML page with CSS and JS, like any site.
- A **web app manifest**: "A PWA must have a web app manifest", with enough information to install it.
- Optionally a **service worker**: "Although a PWA does not need a service worker to be installed, service workers are often used ... to provide at least a minimal offline experience."
- Architecture MDN describes: "the app's pages ... implement the user interface, and the service worker implements a backend which can support offline and background operation".

### Installability (Making PWAs installable)

- Manifest linked with `<link rel="manifest" href="...">`.
- Chromium browsers require: `name` or `short_name`; `icons` with a 192px and a 512px icon; `start_url`; `display` and/or `display_override`; `prefer_related_applications` false or absent.
- Must be served over `https` (or `localhost` / `127.0.0.1`). Netlify serves HTTPS.
- iOS: 16.4+ can install from the Share menu in Safari, Chrome, Edge, Firefox, Orion; "Triggering the install prompt is not supported on iOS."
- Firefox "does not support installing PWAs using a manifest file"; mobile Firefox adds a browser-badged shortcut.

### SPA or not

- "PWAs don't have to be single-page apps". Our app has two entry points (`/` and `/console/`); that is fine.

### Progressive enhancement

- "PWAs should perform feature detection for advanced APIs and provide acceptable fallback experiences." If the browser cannot install, the app must still work as a normal website.

### Design consequences

| Concern | Decision it supports |
|---|---|
| The service worker is the "backend" for offline | Cache app shell + last data in the browser; no server cache needed for weather |
| Manifest + HTTPS are enough to install | No extra hosting or native wrapper for v1 |
| iOS has no install prompt | UX must show manual "Add to Home Screen" steps (Wren) |
| Feature detection required | Push (v2) is optional, never required |

## Part B - Open-Meteo terms (why the browser calls it directly)

- Free use is **non-commercial** (as interpreted by Creative Commons). Examples allowed: "Private or non-profit websites or apps that do not have subscriptions or advertising"; voluntary donations are permitted.
- Limits: "Less than 10'000 API calls per day, 5'000 per hour and 600 per minute."
- Key sentence: "Rate limits are applied by IP addresses and application. If you are using providers like Vercel, Netlify, Render, or Google Sheets you might be rate-limited earlier then expected." They suggest Cloudflare Workers "as we apply limits per Cloudflare user" (another host - excluded by fixed decision 1).
- Misuse: "We reserve the right to block applications and IP addresses that misuse our service without prior notice."
- Commercial use or more calls: subscribe to an API plan (pricing page).
- Licence: CC BY 4.0. "You must include a link next to any location Open-Meteo data are displayed", example:

```html
<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a>
```

### Design consequences

1. Calling Open-Meteo from Netlify Functions would put every user behind Netlify's shared egress IPs -> early rate limiting. Calling from each phone spreads requests across user IPs. (ADR in examples/01.)
2. The per-application limit still applies across all users (unconfirmed how "application" is identified; likely Referer/Origin). Batch all cities in one request (comma-separated coordinates) and cache in the browser to stay well under 10,000/day.
3. Ads or subscriptions would end free use: any monetisation idea must go to the owner first.
4. The credit link must sit next to every place Open-Meteo data are shown, not only in an About page.
