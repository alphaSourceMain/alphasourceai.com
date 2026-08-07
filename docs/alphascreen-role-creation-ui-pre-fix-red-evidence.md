# alphaScreen role-creation UI pre-fix red evidence

Recorded against QA frontend `main` at `243c22c367bfe322cbccef9cfc1ea50267d2d544` before implementation.

The accepted historical layout reference is `4ad501f3535edfba15a7a036673eff46e470c8e5`. It used a compact `w-44` Interview Type control in the client Role Creation form and a compact `w-40` control in the Super Admin form.

The current implementation violates the requested visual contract in five bounded ways:

1. Both role-creation selectors use an expanding `min-w-[18rem] flex-1` container instead of the historical compact widths.
2. Both role-creation selectors render the selected type's descriptive prose directly underneath the dropdown.
3. Both role-creation forms render a large membership/interview-type summary-card row below the controls.
4. The expandable Role Creation guide embeds all eight FAQ items even though the approved content already exists on the dashboard and public FAQ surfaces.
5. The expandable heading reads `Interview type selection guide and FAQ` instead of `Interview Type Selection Guide`.

The deterministic red contract is `artifacts/alphasource-website/test/role-creation-ui-cleanup.test.mjs`. It must fail before the implementation and pass afterward without changing membership capacity, interview-type substance, canonical writes, legacy reads, role creation, role editing, or non-regeneration behavior.
