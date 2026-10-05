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

---

# alphaScreen 8C Placement Refinement - Design QA

## Scope

- QA frontend only. Production is outside this change.
- Public alphaScreen and pricing heroes use the owner's field-free teal 8C full-name lockup with restrained mark-only breathing.
- Dashboard chrome keeps a static lockup, enlarges the mark to 40 px full / 36 px compact, and uses a white wordmark on navy.
- Candidate interview, live interview, text interview, accommodation, terms, and SMS-evidence headers use a static alphaScreen 8C lockup.
- Corporate alphaSource navbar/footer identity, Patent Pending, dashboard support/tour controls, OTP/SMS behavior, and routes remain unchanged.

## Source Visual Truth

- alphaScreen page: `/private/var/folders/4y/1dcg3x8j7311g869tdrtrb7c0000gn/T/codex-clipboard-dd4e7eb1-0f08-44fb-b9ae-9ee5a786671d.png` (1829 x 951).
- Pricing page: `/private/var/folders/4y/1dcg3x8j7311g869tdrtrb7c0000gn/T/codex-clipboard-0bd24d0c-0823-412e-adf1-9732bef2cfc3.png` (1829 x 951).
- Authenticated dashboard: `/private/var/folders/4y/1dcg3x8j7311g869tdrtrb7c0000gn/T/codex-clipboard-d3be7801-2cba-4d98-b5ff-68b8e6b7582e.png` (1829 x 1125).
- Candidate entry: `/private/var/folders/4y/1dcg3x8j7311g869tdrtrb7c0000gn/T/codex-clipboard-86adea02-2bee-4127-9101-0bd59f6b2525.png` (1829 x 1125).
- Logo geometry source: the owner's exact `lockup-icon-08-white.png` and `lockup-icon-09-white.png` exports from `alphaScreen-logo-directions.pdf`.

## Comparison Evidence

- alphaScreen full view: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-refinement-qa-20260827/compare-alphascreen-full.png` (3658 x 951).
- alphaScreen focus: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-refinement-qa-20260827/compare-alphascreen-focus.png` (1600 x 550).
- Pricing full view: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-refinement-qa-20260827/compare-pricing-full.png` (3658 x 951).
- Pricing focus: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-refinement-qa-20260827/compare-pricing-focus.png` (1640 x 600).
- Candidate full view: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-refinement-qa-20260827/compare-candidate-full.png` (3658 x 1125).
- Candidate focus: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-refinement-qa-20260827/compare-candidate-focus.png` (1829 x 200).
- Each comparison places the current owner-supplied screenshot on the left and the local implementation at the same viewport on the right.

## Required Fidelity Surfaces

- Asset fidelity: teal masters are path-only vectors traced from the owner's exact 08/09 exports; the full-name wordmark uses Raleway ExtraLight 200.
- Motion: only the mark breathes; the wordmark remains static. Motion is three 2,400 ms cycles, settles on 08, and reduced-motion displays static 08.
- Public hierarchy: the field-free lockup replaces the prior filled-square/product treatment without displacing Patent Pending, calls to action, or the pricing membership H1.
- Candidate hierarchy: the alphaScreen lockup replaces the corporate header identity without altering form, verification, resume, accommodation, or submission controls.
- Dashboard hierarchy: the mark is enlarged within the existing sidebar slot and remains static; the dark sidebar receives a white wordmark for contrast.

## Comparison History

1. P1 accessibility - the first composite lockup hid its visible wordmark and applied `aria-label` to a generic span.
   - Fix: expose the visible `alphaScreen` text, remove the unsupported wrapper label, keep only the mark decorative, and add verifier assertions for that contract.
   - Post-fix result: TypeScript, production build, brand/accessibility verifier, and 136/136 frontend tests pass; Grok Build 4.6 changed its verdict from DENY to APPROVE.
2. Visual comparison - public alphaScreen, pricing, and candidate surfaces showed no actionable P0, P1, or P2 mismatch after the approved refinements.
3. Authenticated dashboard - source-level layout and sizing passed review; hosted visual confirmation remains the post-deploy UAT gate.

## Browser Interaction and Console Checks

- Local alphaScreen, pricing, and candidate pages were rendered in the in-app Browser using the QA environment configuration.
- Successful comparison passes produced no new application console errors.
- An initial preview without QA environment values produced expected stale configuration/network errors; that preview was discarded and restarted with the QA configuration before evidence capture.
- Public/candidate layout, navigation, CTA, form, and responsive continuity were inspected. No source route or interaction handler was changed.

## Independent Review

- Round 1 DENY: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-refinement-qa-20260827/grok-4.6-round-1-verdict.md`.
- Round 2 APPROVE: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-refinement-qa-20260827/grok-4.6-round-2-verdict.md`.

## Final Result

final result: pending hosted authenticated dashboard QA

---

# alphaScreen Brand and Motion System - Design QA

## Scope

- Approved Figma file: `iajQJtowOf4cFTCnghYgmq`.
- Reference frames: public website `24:16`, dashboard `24:39`, processing `24:134`, report `24:146`.
- Code applies the approved brand roles to the existing alphaSource/alphaScreen product without replacing established page content, routes, dashboard controls, or report structure.

## Evidence

- Vector source-to-render comparison: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-qa-20260826/frontend/alphascreen-brand-qa-20260826/vector-fidelity/source-vs-vector-duotone.png`.
- Figma-to-browser public comparison: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-qa-20260826/frontend/alphascreen-brand-qa-20260826/compare-public-figma-vs-local.png`.
- Mobile browser capture at 390 x 844: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-qa-20260826/frontend/alphascreen-brand-qa-20260826/local-public-mobile.png`.
- Active processing state: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-qa-20260826/frontend/alphascreen-brand-qa-20260826/local-processing-active.png`.
- Settled processing state: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-qa-20260826/frontend/alphascreen-brand-qa-20260826/local-processing-settled.png`.
- Figma report and rendered PDF comparison: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-qa-20260826/backend/alphascreen-brand-qa-20260826/compare-report-figma-vs-render.png`.
- Grok Build 4.6 Senior QA approval: `/Users/jasongardner/Desktop/ai-interview-final/QA/evidence/alphascreen-brand-qa-20260826/grok-4.6-senior-qa-result.md`.

## Findings and corrections

1. The first browser pass used a heavier split-weight wordmark than the approved Figma lockup.
   - Corrected to a single medium-weight `alphaScreen` wordmark and reduced the public hero scale.
   - The refined desktop and mobile captures show the lighter lockup without clipping or overflow.
2. #09 exposure is confined to the active layer of the breathing component.
   - Static lockups, persistent dashboard chrome, and the candidate report use #08 only.
3. Motion is task-bound and restrained.
   - Three 2,400 ms cycles finish on #08; reduced-motion CSS disables the animation and hides #09.
4. The Figma public/report frames are conceptual brand-placement references, not replacements for the product's working page copy, video, dashboard data, or report sections.
   - Comparison focused on mark treatment, wordmark, hierarchy, context, motion role, and static-document behavior.

## Verification

- Eight SVG masters contain path geometry and no raster `<image>` or embedded image data.
- Source-to-vector normalized RMSE range: 0.0308761 to 0.0537961; no material visible divergence found in side-by-side inspection.
- Desktop and mobile public surfaces preserve the corporate alphaSource header while clearly identifying the alphaScreen product.
- The active processing example breathes; its settled capture returns to #08.
- The rendered candidate report has a sharp static navy #08 lockup and preserves the existing first-page Patent Pending wording.
- Typecheck, production build, prerender/HTML integrity, route verification, brand-contract verification, and the full backend suite pass.
- Grok Build 4.6 verdict: APPROVE, with hosted authenticated QA UAT retained as the post-deploy gate.

## Final Result

final result: passed
# QA carnival sales-race integration — October5,2026

Source visual truth: `/Users/jasongardner/Desktop/ai-interview-final/QA/output/sales-carnival-preview-20261005/summary-v2-desktop.png`, approved sample carnival mock. Integrated native page `http://127.0.0.1:4181/sales/race`, existing DEV-only sales mock, never authenticated hosted acceptance. Render QA is a separate final check.

Source and implementation both 1487×1058 pixels at CSS1487×1058,1× density, snapshotA, collapsed setup. Implementation `/Users/jasongardner/Desktop/ai-interview-final/QA/tmp/carnival-integrated-desktop-20261005.png`. Full combined comparison `tmp/carnival-integrated-comparison-20261005.png`2974×1058; focused summary `tmp/carnival-integrated-summary-comparison-20261005.png`2974×200, opened together. Phone320×900CSS full screenshot `tmp/carnival-integrated-mobile-20261005.png`320×1444. Document widths match viewport, all controls readable.

Findings history: initial integration inherited app line-height1.5, increasing summary90→97 and pushing race7px down [P2]. Fixed isolated `.sales-race-page {line-height:normal}`; recapture restores exact90px summary at y226 and approved major-region rhythm. Restored filled library stars and play icon. No remaining actionableP0/P1/P2. Existing Lucide icons substitute closest matching silhouettes for standalone Phosphor icons; slightly heavier stroke is acceptableP3, not generated-art substitution.

Required surfaces: locally bundled same Inter/DM Serif font files, renamed RaceInter/RaceDisplay to avoid app font collision; sizes/weights/hierarchy retained. Scoped padding/grid/90px summary/race placement match target. Cream/navy/purple/teal tokens unchanged. All cabinet/header/alpha horses/approved logo byte-identical to selected preview, no CSS/handmade image substitutes. Copy remains sample-only, productalphaScreen first, no header timezone; four equal summary sections. QA/sample/not-payroll labels persistent; no real contest/revenue claims.

Primary interactions tested in Chrome: A395/B798/Reset395, fixed lane order; setup disclosure; validDec1–31 dates update label; reversed date fails with previous valid date retained; native Sales hub link returns in-app hub; nav link returns race. Hub retains Raleway/default admin styling rather than RaceDisplay; no race container or duplicate sidebar remains. Mobile layout and image loading checked. Console has only earlier missing local auth placeholders from initial boot; after restarting with nonfunctional loopback placeholders, no new error/warn entries. These placeholders are CLI-only and not source/env changes.

19 tests pass (contest12, host/auth/stylegate2, existing hub/signature5). Full app typecheck/build plus14publicprerender/15HTMLintegrity pass; existing sourcemap/largechunk warnings remain. Page lazy-loaded11KBJS/15KBCSS, artwork/fonts8.6MB total. No new npm dependencies. Existing SalesApp authentication/verifiedrep/admin gate retained; exact QA hostname or DEV required before race is rendered. No backend/schema/env/call/routing/payment/account change.

Residual limitations: real screen-reader/high contrast not run; no receipt source or saved contest; hosted actual signed-in UI acceptance pending after deployment. Exact candidate Grok review recorded separately before deployment. Production untouched.

final result: passed

---
