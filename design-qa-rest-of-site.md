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
- No actionable P0, P1, or P2 issues remain.

## Final result

Passed.
