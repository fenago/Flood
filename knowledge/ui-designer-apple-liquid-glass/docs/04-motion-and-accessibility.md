Source: https://developer.apple.com/design/human-interface-guidelines/motion
Source: https://developer.apple.com/design/human-interface-guidelines/accessibility
Source: https://www.w3.org/WAI/WCAG22/quickref/
Retrieved: 2026-11-26

# Motion and visual accessibility

## Motion (HIG)
- Add motion only with a purpose; never for its own sake. Excess animation distracts
  and can make people feel unwell.
- Feedback animation should be brief and precise.
- Avoid animating interactions that happen very often.
- Do not make people wait for an animation before they can act.
- Liquid Glass reacts more strongly to touch than to trackpad input.
- Back up visual feedback with other channels where available (haptics/sound on native;
  on the web, text and `aria-live` announcements).

Flood Watch tokens: `--motion-fast` 150 ms, `--motion-base` 250 ms (cap 300 ms),
one gentle spring curve. No animated waves, no looping motion on the outlook screen.

## When Reduce Motion is on (HIG Accessibility)
- Cut automatic and repeating animations, including zoom, scale and peripheral motion.
- Tighten springs to reduce bounce.
- Track animations directly to the gesture.
- Avoid animating depth (z-axis) changes.
- Replace x/y/z slides with fades.
- Avoid animating into and out of blur. (Relevant for glass sheets: when reduced, show
  the sheet's final blur immediately.)
Web: `@media (prefers-reduced-motion: reduce)` sets motion tokens to 0 ms.
WCAG 2.3.3 Animation from Interactions (AAA): motion triggered by interaction can be
turned off unless essential - we meet it via the media query.

## Flashing
Be careful with fast-moving and blinking animation; it can trigger seizures (HIG).
No flashing alert banners, even for Severe.

## Targets and spacing (HIG Accessibility)
| Platform | Default control | Minimum control |
|---|---|---|
| iOS, iPadOS | 44 x 44 pt | 28 x 28 pt |
| watchOS | 44 x 44 pt | 28 x 28 pt |
| visionOS | 60 x 60 pt | 28 x 28 pt |
- Padding: about **12 pt** around elements with a bezel, about **24 pt** around
  elements without one.
- WCAG 2.5.8 (AA) floor: 24 x 24 CSS px (or spacing so a 24 px circle does not overlap
  another target). Flood Watch: 44 px for every tab and primary button (`--target-min`).

## Contrast and colour
- See 02-color-and-dark-mode.md. Key numbers: 4.5:1 text, 3:1 large text and UI parts,
  aim 7:1 for small custom-colour text.
- If default colours fall short, at least offer higher contrast when Increase Contrast
  is on (HIG). Web: `prefers-contrast: more` block in tokens.

## Text size
- iOS default 17 pt, minimum 11 pt. Support enlarging text to 200%.

## Visual review checklist for Sable
1. Every text/background pair in tokens passes `contrast-check.mjs`.
2. Text on glass checked over black and white backdrops.
3. Risk levels distinguishable in greyscale (lightness order) and with icon + word.
4. Focus ring 3:1 against both page and card; never hidden under the tab bar
   (WCAG 2.4.11 AA: focused item not entirely hidden by author content).
5. Reduced motion, reduced transparency and increased contrast each produce a usable,
   solid layout.
6. Reflow at 320 CSS px wide with no horizontal scroll (WCAG 1.4.10).
