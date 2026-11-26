---
name: web-push
description: Add opt-in flood alert push notifications to Flood Watch with VAPID, subscriptions in Netlify Blobs and a scheduled function. Use when working on notifications (planned for v2).
user-invocable: false
---
# Web push (v2)

- Ask permission only after a user taps "Alert me for <city>". On iOS this works only when installed to the Home Screen; explain that first.
- VAPID key pair: public key in the client, private key in `VAPID_PRIVATE_KEY` (Functions scope, secret).
- Store subscriptions in Blobs `push/<hash-of-endpoint>` with city and threshold; delete on 404/410 from the push service.
- Scheduled Function (e.g. every 30 min) computes risk per subscribed city and sends only on a **change upward** to High/Severe or a new NWS warning. Max 3 pushes per city per day.
- Payload: level, city, one-line reason, link to the city page. No personal data.
- Provide an easy "Stop alerts" in-app.
