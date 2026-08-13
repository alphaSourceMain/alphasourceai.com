# Public Site Rest-of-Site Refresh — Design QA

## Visual source of truth

- Figma file: `XyJlaQda7mxfFoyIRNFgY6`
- Page: `03 — Public Site Rest-of-Site Refresh` (`72:66`)
- Representative frames reviewed:
  - About: light `73:72`, dark `73:409`
  - alphaScreen overview: light `73:132`, dark `73:469`
  - Product detail: light `73:180`, dark `73:517`
  - Pricing: light `73:234`, dark `73:571`
  - FAQ/support: light `73:297`, dark `73:634`
  - Legal: light `73:356`, dark `73:693`
- Figma source frame size: 1440 × 1100.
- Browser comparison viewport: approximately 1275 × 715. The comparison was normalized as a viewport crop rather than treating the Figma frame as an exact full-page state.

## Implementation evidence

- About, light: `/private/tmp/alphasource-about-light-qa.png`
- Pricing, dark: `/private/tmp/alphasource-pricing-dark-qa.png`
- FAQ expanded state, light: `/private/tmp/alphasource-faq-light-open-qa.png`
- Shared footer, dark: `/private/tmp/alphasource-footer-dark-qa.png`

## Full-view comparison

The Figma About light frame and the local About light implementation were inspected in the same comparison input. The implementation matches the approved hierarchy, restrained gradient, typography scale, rounded treatment, appearance control, and dark footer. Existing portraits and biographies remain unchanged, as required, so the live content is intentionally richer than the schematic Figma cards.

## Focused comparisons

- Header: preserved route set and sign-in behavior; spacing remains uncrowded at the tested desktop viewport; the styled Light/Dark/System selector matches the dashboard treatment.
- Hero and sections: subtle gradient and soft surface treatment follow the mockup without restructuring public-page content.
- Cards and accordions: existing information and interactions remain intact, with the approved border, radius, surface, and dark-mode treatment.
- Footer: the two-column Explore/Product hierarchy, refined email/support labels, and dark foundation match the approved direction while preserving the canonical support number.
- Legal pages: long-form content remains readable in both modes with bounded content surfaces and no copy changes.

## Fidelity surfaces

1. Information hierarchy — passed.
2. Spacing and alignment — passed.
3. Typography and emphasis — passed.
4. Color, contrast, borders, and radii — passed in light and dark.
5. Responsive and interaction behavior — passed at desktop viewport; existing mobile menu behavior remains covered by source tests.

## Interaction coverage

- Appearance menu: Light, Dark, and System choices render through the styled menu.
- FAQ: accordion expansion remains functional.
- Privacy choices: banner and configuration dialog inherit the selected public theme.
- Navigation, product links, CTA links, forms, and sign-in controls remain wired.
- No console warnings or errors were observed during the visual route pass.

## Issue history

- P2: the privacy notice originally rendered outside the appearance provider and stayed light in dark mode. Fixed by placing it inside the public theme shell; dark banner and dialog rechecked.
- P2: the desktop appearance control could briefly shrink during route transitions. Fixed with a non-shrinking, no-wrap trigger; header spacing rechecked.
- P2: the two Technology card descriptions used inline navy colors that overrode the dark-theme text mapping. Fixed by moving both colors and the emphasized weight into theme-aware utility classes. Post-fix evidence: `/private/tmp/alphasource-about-technology-dark-fixed.png`.
- P2: the four alphaScreen How It Works cards followed their individual content height, leaving card three taller than the others. Fixed by using card three's 170px height as the shared minimum and allowing growth when responsive wrapping requires it. All four rendered desktop cards measured `290.5 × 170` CSS pixels. Post-fix evidence: `/private/tmp/alphasource-how-it-works-equal-cards-dark-fixed.png`.
- No actionable P0, P1, or P2 issues remain.

## Final refinement comparison

- Source issue captures: `/private/var/folders/4y/1dcg3x8j7311g869tdrtrb7c0000gn/T/codex-clipboard-2d6a0a6a-39d4-4a70-808c-d1e09d07f37a.png` and `/private/var/folders/4y/1dcg3x8j7311g869tdrtrb7c0000gn/T/codex-clipboard-738ff5b5-6905-458a-a6b7-3ba887effae9.png`.
- Source pixels: `1715 × 1316` at the owner's desktop dark-mode view.
- Implementation pixels: `1274 × 717` at the in-app desktop dark-mode viewport and device scale factor 1.
- The focused Technology and How It Works regions were reviewed together with their corresponding implementation captures. The intended differences—light card copy and equal 170px workflow cards—are visible, while surrounding typography, spacing, palette, content, icons, and behavior remain unchanged.
- Browser console warnings/errors: none.

## Final result

final result: passed
