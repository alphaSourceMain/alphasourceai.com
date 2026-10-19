Rebuild the alphasourceai.com marketing site to match the approved design in design-reference/alphasource-b1 EXACTLY.

Source of truth: design-reference/alphasource-b1/index.html (open it in a browser), plus b1-1440.png (desktop) and b1-390.png (mobile). Match layout, spacing, typography (fonts, sizes, weights, line-heights), colors and gradients, borders, radii, shadows, hover states, motion (fade-ins, reduced-motion handling), and the mobile menu behavior (hamburger, full-screen solid panel, Escape/link-tap closes, focus handling). Lift CSS values directly from the reference rather than approximating. Use the logo files in design-reference/assets (transparent; never place them on a white box).

Rules:
- Port into the site's existing framework, components, and build. Keep existing routes, metadata/SEO tags, analytics, forms and their submit endpoints, and any integrations working.
- Use the copy in the reference; don't invent facts, numbers, clients, or testimonials. Keep the "Illustrative" labels on mock visuals.
- No all-caps body or service text.

Rollout:
1. Dev: implement on a feature branch. Produce side-by-side screenshots (reference vs. build) at 1440 and 390 for every section, and fix any visible differences.
2. QA: deploy to QA/preview. Run Lighthouse (performance, accessibility, SEO), check links and the contact form, and confirm no console errors. Report results and the preview URL.
3. Prod: STOP and wait for Jason's explicit approval before promoting. Don't promote automatically.

Report back with the branch/PR, the preview URL, the comparison screenshots, and anything you couldn't match exactly and why.
