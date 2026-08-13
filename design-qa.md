# Public Homepage Refresh — Design QA

## Evidence

- Source visual truth (light): `/private/tmp/alphasource-light-full-refined-v2.png`
- Source visual truth (dark): `/private/tmp/alphasource-dark-full-refined.png`
- Implementation capture (light): `/private/tmp/alphasource-home-light-clean-implementation.png`
- Implementation capture (dark): `/private/tmp/alphasource-home-dark-clean-implementation.png`
- Normalized light comparison: `/private/tmp/alphasource-light-comparison.png`
- Normalized dark comparison: `/private/tmp/alphasource-dark-comparison.png`
- Supporting captures: `/private/tmp/alphasource-home-light-values-people.png`, `/private/tmp/alphasource-home-dark-values-people.png`, `/private/tmp/alphasource-home-dark-meet.png`, `/private/tmp/alphasource-home-dark-contact.png`, `/private/tmp/alphasource-home-mobile-top-aligned.png`
- Figma nodes: light `48:67`; dark `63:196`; file `XyJlaQda7mxfFoyIRNFgY6`

## Capture Normalization

- Browser viewport override requested: 1440 × 1000 CSS px.
- In-app Browser screenshot output: 1274 × 717 px at device scale factor 1.
- Figma full-page exports: 783 × 2400 px each.
- The comparable Figma header/hero region was cropped to 783 × 442 and normalized to 1274 × 717 before side-by-side review.
- States compared: homepage light, homepage dark, desktop header/hero, value band, people section, Meet alphaScreen, contact form, and 390 px mobile.

## Required Fidelity Surfaces

- Fonts and typography: Raleway, weights, hierarchy, wrapping, and CTA labeling match the approved direction. The coded hero intentionally retains the existing production-source composition and scale per owner instruction.
- Spacing and layout rhythm: header breathing room, separate dark value band, section padding, card rhythm, and mobile stacking are consistent with the mock. The Appearance control no longer crowds navigation.
- Colors and visual tokens: light and dark palettes track the Figma navy/lavender/teal system. Dark cards, borders, form fields, and hero panel maintain readable contrast.
- Image quality and asset fidelity: existing official light/dark logos and alpha symbol are reused. No placeholder assets were introduced.
- Copy and content: existing homepage copy, routes, CTAs, form fields, support number, and product naming are unchanged.

## Full-View Comparison

- Light and dark header/hero comparisons show matching information hierarchy, palette, two-column layout, pills, CTAs, floating workflow card, and status badges.
- The workflow illustration and Meet alphaScreen terminal retain their existing Framer Motion behavior; the static Figma annotations are implemented by the already-approved source animations.
- The continuous dark value band appears immediately below the hero in both modes.

## Focused Region Comparison

- Header: dashboard-style Appearance control, 88 px header, official theme-aware logo, navigation spacing, and Sign In affordance verified.
- Meet alphaScreen: all four staged log lines and the delayed Screening Complete state were visibly present after the animation window.
- Contact: dark mode form surface, labels, fields, placeholders, checklist, and submit control verified.
- Mobile: hero stack, CTAs, workflow card, hamburger menu, and explicit `Appearance / System` label verified at 390 px.

## Comparison History

1. P1 — Public routes outside the approved homepage inherited the dark header while their page bodies remained light.
   - Fix: scope the new public dark treatment and Appearance selector to the approved homepage; existing public routes remain visually unchanged.
   - Post-fix evidence: `/about` reports `data-theme="light"`, exposes no Appearance control, and renders its existing content normally even when the stored homepage preference is dark.
2. P2 — The mobile Appearance trigger initially collapsed to an icon-only control.
   - Fix: added the dashboard-style full-width mobile trigger with explicit Appearance and selected-mode labels.
   - Post-fix evidence: the mobile menu exposes `Appearance` and `System` visibly and all three radio options remain keyboard/ARIA-addressable.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- P3: the live hero illustration is slightly larger and more energetic than the static Figma crop. This is intentional because the owner required the original animated hero graphic to remain intact.

## Interaction and Console Checks

- Light, Dark, and System selection tested.
- Preference persistence tested on homepage reload/navigation.
- Mobile menu and mobile Appearance control tested.
- Home, About, alphaScreen, How It Works, Get in Touch, FAQ, and Sign In affordances remained present.
- Privacy overlay was dismissed through its existing local preference flow for unobstructed captures.
- The production-equivalent build produced no application runtime errors. The only build notices were existing source-map/chunk-size warnings.

## Final Result

final result: passed
