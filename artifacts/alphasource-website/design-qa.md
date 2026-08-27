# Option 3 Dashboard Design QA

## Source of truth

- Figma file: `XyJlaQda7mxfFoyIRNFgY6`
- Approved client frame: `20:4`
- Approved admin frame: `20:5`
- Reference export: `/tmp/figma-dashboard-client-option3-final-v3.png`
- Reference dimensions: 1440 × 1024

## Implementation under test

- Hosted QA: `https://alphasourceai-com.onrender.com/dashboard`
- QA commit: `0ca58ee10b1d8d37a250cefd11b25e200e293a17`
- Browser viewport: 1660 × 1129 CSS pixels
- Captured implementation image: 1504 × 1027 pixels
- State: authenticated QA client scope with current server data

The hosted capture was opened beside the approved Figma export in one visual comparison input. The live-data capture was deleted immediately after inspection so candidate information was not retained in source control or QA artifacts.

## Comparison history

1. Confirmed the final Figma hierarchy: dark left rail, header client selector, unified metric strip, decision queue, role health, interview activity, recent movement, Quick Guide, and Talk with Support.
2. Compared the hosted QA implementation with that frame at the browser's wide desktop viewport.
3. Preserved intentional live-data substitutions: alphaScreen does not expose open-requisition, hire-rate, scheduled-call, or event-type data through the current dashboard APIs, so the implementation uses truthful role, capacity, candidate, completion, and review data instead of mock values.
4. Verified dark mode using computed styles after selecting Dark, then restored the user's System appearance setting.
5. Follow-up correction pass on 2026-08-13 restored shared-header titles and descriptions across all client dashboard pages, replaced the native Appearance select with a styled accessible radio menu, and relabeled the Overview candidates link so its destination is honest.

## Findings and corrections

- Restored constrained sidebar scrolling for short viewports.
- Kept existing dashboard pages from receiving duplicate visible page titles.
- Added a collapsed-rail tour trigger so Quick Guide remains reachable.
- Made the comparison-period selector affect period-based metrics.
- Removed nonfunctional checkbox, overflow-menu, and dropdown affordances.
- Kept all candidate, role, and activity panels on the existing authenticated APIs; no Figma sample names or placeholder records ship in the implementation.
- Preserved client search/switching, appearance modes, existing tour behavior, dashboard routes, permission filtering, and support-voice lifecycle.

## Hosted interaction checks

- Client selector opens and exposes 43 authorized scopes: PASS
- Timeframe changes to 7d and returns to 30d: PASS
- Candidate filter toggles All candidates / Review ready: PASS
- Sort toggles Newest / Oldest: PASS
- Talk with Support popover opens without starting a voice session: PASS
- Quick Guide opens the existing eight-step tour and Escape closes it: PASS
- Browser console errors: 0

## Follow-up correction evidence

- Hosted correction commit: `d0e651c40ed9cca4926055e5d5aec69328dce7aa`
- Implementation screenshot: `/tmp/alphascreen-dashboard-header-control-fixes.jpg`
- Shared-header title and description verified on Roles, Automation, Candidates, Members, Billing, Entities, and Support: PASS
- Appearance menu presents Light, Dark, and System as `menuitemradio` choices, with System selected in the captured state: PASS
- Overview link beside Today's decisions reads `All candidates` and routes to `/dashboard/candidates`: PASS
- Browser console errors after correction: 0

## Admin dashboard and Roles refinement

- Hosted QA commit: `7599ffdd246119f5c8cb8218534a17455e71931f`
- Admin route: `https://alphasourceai-com.onrender.com/admin`
- Roles route: `https://alphasourceai-com.onrender.com/dashboard/roles`
- Approved admin reference: `/tmp/admin-option3-figma.png`
- Hosted admin capture: `/tmp/alphascreen-admin-option3-hosted-final.png`
- Hosted Roles capture: `/tmp/alphascreen-roles-controls-hosted-final.png`

The approved admin reference and hosted capture were inspected together in one visual comparison input. The hosted implementation preserves the reference hierarchy: dark 240px admin rail, platform scope selector, compact five-metric strip, client operational review table, right-side context rail, and bottom reliability status. Figma sample client names and unsupported reliability or health claims do not ship; every hosted row and value comes from the authenticated QA admin APIs. Temporary screenshots were kept outside source control.

### Hosted admin acceptance

- Render live commit matches `7599ffd`: PASS
- Platform-wide and selected-client scope copy/values rebind together: PASS
- Five metric cards and all three context-rail panels render from authenticated data: PASS
- Client selector, Appearance menu, timeframe selector, Export control, Add client link, candidates link, and reliability links are present and functional: PASS
- Light and dark appearance render with no horizontal overflow; user setting restored to System: PASS
- Wide hosted viewport: `scrollWidth === innerWidth` (1660 CSS px): PASS
- Browser console errors: 0
- Grok Build 4.5 independent code/design decision after required corrections: APPROVE

### Hosted Roles acceptance

- Role title input height: 48px; radius: 16px
- Interview type select height: 48px; radius: 16px
- Job description drop zone height: 48px; radius: 16px
- No horizontal overflow: PASS
- Existing role data, create flow, filters, actions, support control, and quick guide remain present: PASS

### Final validation

- Frontend tests: 100 passed, 0 failed
- Strict TypeScript: PASS
- Production build: PASS
- Public prerender: 13 routes
- Route verification: 13 public snapshots, 1 SPA shell route, 46 routing rules
- HTML boot integrity: 14 files
- `git diff --check`: PASS

## Final result

passed

---

# alphaScreen Hero Lockup Refinement QA — 2026-08-27

## Source and implementation

- Source visual truth: `/var/folders/4y/1dcg3x8j7311g869tdrtrb7c0000gn/T/codex-clipboard-4b4e8cb7-3382-43d1-853e-357b9913939e.png`
- Source pixels: 1829 × 1276.
- Browser-rendered implementation: `http://localhost:4177/alphascreen`
- Desktop implementation screenshot: `/private/tmp/alphascreen-hero-refinement-desktop-local-v2-20260827.png`
- Desktop implementation pixels: 1596 × 1272 from an 1828 × 1276 CSS viewport override; the in-app browser applied output scaling.
- Mobile implementation screenshot: `/private/tmp/alphascreen-hero-refinement-mobile-local-v2-20260827.png`
- Mobile CSS viewport: 390 × 844; screenshot captured at the in-app browser's output density.
- Narrow-mobile implementation screenshot: `/private/tmp/alphascreen-hero-refinement-320-local-v2-20260827.png`
- Narrow-mobile CSS viewport: 320 × 844.
- Full-view comparison: `/private/tmp/alphascreen-hero-refinement-comparison-20260827.png`
- Focused hero comparison: `/private/tmp/alphascreen-hero-refinement-focused-comparison-v2-20260827.png`
- Comparison normalization: each source/implementation panel was proportionally resized and centered in an equal 900 × 628 full-view frame or 900 × 372 focused frame. Absolute pixel parity was not inferred from the browser's output scaling.
- State: public alphaScreen landing page, light/System appearance, hero at initial scroll position, no consent overlay.

## Findings

- No remaining P0, P1, or P2 mismatch.
- Fonts and typography: the existing alphaScreen extra-light wordmark and public-site typography remain unchanged; the desktop wordmark is about 15% larger and the new small Patent Pending line reads as subordinate lockup metadata.
- Spacing and layout: both desktop columns now top-align; the wordmark top is 160 CSS px, the vector mark top is 170.69 CSS px, and the video card top is 176 CSS px, so the lockup begins slightly above the card as requested. Existing hero body rhythm, CTA spacing, card radius, and elevation remain intact.
- Colors and tokens: the teal breathing mark, navy wordmark, lilac tagline, and restrained lilac patent text continue using the established alphaScreen palette.
- Image quality and asset fidelity: the existing vector 08/09 breathing masters and the same demo video are preserved; no substitute, rasterized, CSS-drawn, or inline-SVG asset was introduced.
- Copy and content: both former pills are removed. Patent Pending appears once as a subscript to the wordmark. All remaining hero copy and calls to action are unchanged.
- Accessibility and behavior: the H1 exposes `alphaScreen Patent Pending`; reduced-motion behavior remains owned by the existing breathing component. Browser console warnings/errors: 0.
- Responsive behavior: the first 390 px pass showed the desktop-sized subscript clipping at the right edge. The corrected mobile layout scales the lockup within the available width and positions Patent Pending directly beneath the wordmark. A follow-up 320 px check prompted by Grok's first-pass residual-risk note then exposed overflow masking at that narrower width; a sub-360 px size tier corrected it. Final 320 px H1 bounds are x=24 to x=292.28 within the 320 px viewport, the patent line is fully visible, and horizontal overflow is 0.

## Comparison history

1. Initial desktop comparison confirmed the requested removal of both pills, larger lockup, and top alignment.
2. Initial mobile comparison found one P2 responsive issue: the Patent Pending subscript was clipped because the enlarged single-line lockup consumed the available width.
3. Fixed the mobile treatment with breakpoint-specific lockup sizing and a right-aligned subscript beneath the wordmark, while keeping the full desktop enlargement and desktop inline subscript.
4. Re-captured at 390 × 844 and 1828 × 1276 CSS viewports. Post-fix evidence shows no clipping, no horizontal overflow, preserved hierarchy, and the requested desktop alignment.
5. After Grok's first APPROVE noted that 320 px was untested, captured `/private/tmp/alphascreen-hero-refinement-320-local-20260827.png`; this exposed a P2 clip hidden by the hero's `overflow-hidden` treatment.
6. Added a sub-360 px lockup tier without changing the approved 390 px or desktop sizes. Re-captured `/private/tmp/alphascreen-hero-refinement-320-local-v2-20260827.png`; the full lockup and subscript fit inside the content width with no console errors or horizontal overflow.

## Interaction and validation evidence

- View pricing, See how it works, and Request demo remain visible and semantically linked.
- Focused patent/hero tests: 11 passed, 0 failed.
- TypeScript: passed.
- alphaScreen vector-brand verifier: passed, 10 masters.
- Production build, 13-route prerender, and 14-file HTML boot-integrity check: passed.
- Narrow-width evidence: 320 × 844 CSS viewport passed after correction.
- Full repository test discovery: 122 passed, 2 unrelated pre-existing support-voice assertion failures. The associated source and test files are byte-identical to `origin/main` and outside this change.

## Final result

passed
