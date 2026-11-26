Source: https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios
Source: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
Source: https://support.apple.com/guide/ipad/bookmark-a-website-ipadc602b75b/ipados
Retrieved: 2026-11-26

# iPhone "Add to Home Screen" journey

Read from Apple Support search excerpts (current iOS guide, links to iOS 27 pages);
details below are paraphrased.

## Apple's current steps (iPhone, Safari)
1. Open the website in Safari.
2. Tap the **Page Menu** button, then **Share**. If the Tabs layout is set to Bottom or
   Top, tap the **Share** button directly.
3. Scroll down the list and tap **Add to Home Screen**. If it is missing: scroll to the
   bottom, tap **Edit Actions**, then add Add to Home Screen.
4. Optionally turn on **Open as Web App** to use the site like an app.
5. Tap **Add**. The icon is only on that device.

iPad: tap Share, tap **View More**, then Add to Home Screen; Open as Web App option;
tap Add.

Implications:
- The Share button's location differs by Safari tab layout and iOS version, so our
  instructions must name the button and not depend on a picture of Apple's icon.
  We may not copy Apple's Share glyph (SF Symbol) into the repo; draw an original
  "box with up arrow" hint or use words only.
- "Open as Web App" must be on for standalone mode; mention it.
- Other iOS browsers (Chrome, Edge, Firefox, Orion) can also add to Home Screen since
  iOS 16.4 (docs/02, MDN); their menus differ - keep steps generic for them.
- There is no install event on iOS; detect installed state with
  `navigator.standalone` or `matchMedia('(display-mode: standalone)')`.

## HIG rules that shape the install sheet
- Onboarding: no upfront install push; offer it after the second visit, once.
- Sheets: scoped task, medium detent, grabber, Done/Close at trailing edge.
- Writing: verbs on buttons, plain steps, no "Click here".
- Feedback: do not nag; one dismissal = no repeat for at least 30 days (our rule).

## Why install matters for Flood Watch
- Faster access during an event; full-screen.
- Web push on iPhone works only for Home Screen web apps (iOS 16.4+), so v2 flood
  alerts depend on it (docs/02).
- Risk: iOS may clear storage for web apps; the app must work with an empty cache.
