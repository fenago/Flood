Source: https://developer.apple.com/design/human-interface-guidelines/writing
Source: https://developer.apple.com/design/human-interface-guidelines/onboarding
Source: https://developer.apple.com/design/human-interface-guidelines/privacy
Source: https://developer.apple.com/design/human-interface-guidelines/notifications
Retrieved: 2026-11-26

# Writing, onboarding, permissions and notifications

## Writing (HIG)
- Decide the voice (who we talk to, what words, how they should feel) and keep a list
  of standard terms. Flood Watch voice: calm, direct, plain; never jokey about risk.
- Match tone to the situation and what the person is physically doing.
- Fewer words; read it aloud when unsure.
- Pick a capitalisation style per element type and keep it. Flood Watch: buttons and
  tabs in title case ("Try Again", "Change City"); sentences in sentence case.
- Buttons and links: use verbs, be clear not clever ("Send", not "Let's do it!").
  Links describe the destination; never "Click here".
- Errors: show them next to the problem, do not blame, say how to fix it. Avoid
  "Oops"/"Uh-oh" and robotic messages like "Invalid name".
- Empty states: give a next step (button or link); do not put crucial info there,
  because empty states are temporary.
- Settings labels: practical names; explain what "on" does; link straight to a
  setting instead of describing where it is.
- Plain language, no jargon, no gendered terms; descriptive link text for screen readers.

### Flood Watch term list
| Use | Avoid |
|---|---|
| flood risk, Low / Elevated / High / Severe | danger score, threat index |
| NWS alert, official alert | warning (unless quoting the NWS product name) |
| high tide, king tide | spring tide, perigean tide (jargon) |
| Updated 10:05 am | Last sync, fetched at |
| beach day score | beach index |

## Onboarding
- Keep it short; let people start using the app right away.
- Make any tutorial optional; if skipped, never show it again automatically.
- Postpone non-essential setup; ship sensible defaults.
- Teach in context with tips, not a long upfront flow.
- No licence text in onboarding.
-> Flood Watch first run: pick a city (or Use My Location) and land on the outlook.
   No carousel. Install hint only after the second visit (apple-hig-ux-flows skill).

## Permission requests (HIG Privacy)
- Ask only when a feature clearly needs it, at the moment people use that feature.
- Avoid asking at launch unless the app cannot work without it.
- The purpose text: one brief, specific, complete sentence, sentence case, active voice,
  ending with a period.
- Pre-permission screen (optional): **one** button that clearly opens the system prompt,
  titled "Continue" or "Next"; no cancel/close and no other actions on that screen
  (unless legally required).
-> "Use My Location" triggers the browser geolocation prompt directly; we explain in
   the button's helper text: "Finds the closest city in our list. Your location stays on
   this phone." If denied, the city list remains; no repeat prompts.
-> Web push (v2) is asked only after the user taps "Alert me" and, on iPhone, only in
   the installed Home Screen app (iOS 16.4+, per docs/02).

## Notifications (HIG)
- You need consent before sending any.
- Short title in title case with no end punctuation if it adds context; body in complete
  sentences, sentence case, not truncated.
- Do not include the app name or icon in the text, or sensitive personal info. Provide
  generic text for hidden previews.
- People can turn notifications off entirely if you flood Notification Center with
  repeats -> one notification per city per level change, never repeats.
- The Notifications page read did not cover interruption levels (passive, active,
  time-sensitive, critical); treat any claim about them as (unconfirmed).

Example (v2):
Title: Flood Risk High
Body: Miami Beach, tonight: king tide at 7:42 pm and heavy rain. Not an official warning.
