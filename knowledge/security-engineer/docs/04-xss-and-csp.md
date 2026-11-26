# XSS prevention and Content Security Policy

Source: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
Source: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
Source: https://docs.netlify.com/manage/routing/headers/
Retrieved: 2026-11-26

Applies to: console chat rendering, diff view, public app rendering of API text (NWS alert text,
city names), `[[headers]]` in `netlify.toml`, headers set by Functions. Skill: `prompt-injection-xss-defense`.

## XSS: treat agent output and API text as hostile

Agent replies, proposal diffs, NWS alert descriptions and geocoding names are all untrusted input.

**Safe sinks** (OWASP): `textContent`, `createTextNode()`, `insertAdjacentText()`, `className`,
`value`, `setAttribute()` for *safe* attribute names.
**Dangerous sinks**: `innerHTML`, `outerHTML`, `document.write`, `eval`, string forms of
`setTimeout`/`setInterval`, `new Function`.

Rules for Flood Watch:
- Render chat and diffs with `textContent` (diff lines as text nodes inside `<pre>`/`<span>`).
- If Markdown is ever rendered: produce HTML, then sanitise with DOMPurify (OWASP's recommendation)
  before assigning; allow no raw HTML, strip `javascript:`/`data:` URLs, add `rel="noopener noreferrer"`.
- Never build URLs from untrusted text without checking the scheme is `https:`.
- CSS: never interpolate untrusted strings into CSS; use `element.style.setProperty()`.
- Encoding is per context (HTML body, attribute, JS string, CSS, URL); the safest choice in vanilla JS
  is to avoid string-built HTML entirely.

## CSP essentials (OWASP CSP cheat sheet)

- Deliver CSP as an **HTTP header** (full feature set). `<meta>` works for most things but **not**
  `frame-ancestors`, `sandbox` or reporting.
- `default-src` is the fallback for other fetch directives.
- `script-src` - where scripts may load from. No `'unsafe-inline'` (allows inline script/style) and
  no `'unsafe-eval'` (allows `eval`).
- `connect-src` - limits `fetch`, XHR, EventSource, beacons, WebSockets. This is our main
  exfiltration control: a malicious approved change cannot post data to a new host.
- `object-src 'none'`, `base-uri` (restrict `<base>`), `form-action`, `frame-ancestors`
  (who may embed us; `'none'` stops click-jacking), `upgrade-insecure-requests`.
- Strict CSP: nonces (fresh per response) or hashes, optionally `'strict-dynamic'`. We have no inline
  scripts, so `script-src 'self'` is enough and needs no per-response nonce (static hosting).
- Roll out with `Content-Security-Policy-Report-Only` first if unsure; violations show in the console.
- OWASP's basic example: `default-src 'self'; frame-ancestors 'self'; form-action 'self';` and a tighter
  `default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; ...`.

## Our policies

Public app (`/*`):
```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self';
manifest-src 'self'; worker-src 'self';
connect-src 'self' https://api.open-meteo.com https://marine-api.open-meteo.com
  https://geocoding-api.open-meteo.com https://api.tidesandcurrents.noaa.gov https://api.weather.gov;
object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```
Console (`/console/*`): same but `connect-src 'self'`, plus `Cache-Control: no-store`,
`Referrer-Policy: no-referrer`. Browsers enforce every CSP header they receive, so the extra rule can
only tighten the `/*` rule (CSP spec behaviour, not stated on the pages read; how Netlify combines two
matching `[[headers]]` rules is also (unconfirmed) - check the response headers on a Deploy Preview).

Function responses (JSON/SSE): `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`,
`X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, correct `Content-Type`.

## Netlify facts that matter (custom headers page)

- Headers come from `_headers` in the publish dir or `[[headers]]` in `netlify.toml`.
- They apply **only to files Netlify serves from its own store** - **not** to Function, Edge Function
  or proxied responses. Every Function must set its own security headers.
- Netlify will not let you override some headers, including `Set-Cookie`, `Location`, `Content-Length`,
  `Content-Encoding`, `Server`, `Date`.
- `for` paths support `*` wildcards and `:placeholders` (placeholder only at segment start).

## Review triggers (flag in the diff view)

Any change to `connect-src`-like host lists, new `fetch(` targets, `<script`, `innerHTML`,
`insertAdjacentHTML`, `eval(`, `new Function`, `javascript:` URLs, or CSP text. Proposals cannot touch
`netlify.toml`, but `public/` HTML could add a `<meta http-equiv="Content-Security-Policy">` - harmless
(it can only add restrictions) yet worth flagging.

Worked example: `../examples/security-headers.toml` + `check-headers.mjs` (lint passes; catches
`'unsafe-inline'`).
