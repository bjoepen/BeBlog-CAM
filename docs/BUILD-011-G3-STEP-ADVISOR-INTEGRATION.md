# Build 011-G3 — STEP Feature Advisor Integration

## Scope

011-G3 adds a read-only feature overview to the existing STEP Advisor inspector. It does not create operations, select geometry, generate toolpaths or NC, change production preflight, or alter the application version.

## Architecture and data flow

While the **Prüfen** step is active, `App.svelte` creates the existing verified `AdvisorContext` from the imported source-content SHA-256, orientation, stock, WCS, material, tool library and capability revision. From the same context it independently computes:

1. the G1 STEP manufacturing feature inventory;
2. the G2 feature classification;
3. the existing `screenStepFeasibility()` report and its exact reviewed-context snapshot.

`buildStepAdvisorFeatureOverview()` joins these immutable results. The adapter preserves G1 ordering, feature IDs, measurements and native face/wire/edge references. G2 remains the source for recognition status, qualitative confidence, evidence, possible interpretations, unknowns and limitations. The existing Advisor report remains the only source for drill/helical feasibility.

## Source-of-truth boundaries

- G1 is authoritative for native STEP/BRep geometric inventory and measurements.
- G2 is authoritative for geometric classification and uncertainty.
- `screenStepFeasibility()` is authoritative only for its existing hole and rejected-cylinder findings.
- Production operation selection and preflight remain authoritative for machining execution.

The adapter introduces no operation capability matrix and never converts a plausible interpretation into a selected operation.

## Feature-to-feasibility matching

A feasibility finding is associated only when all of the following hold:

- the reviewed Advisor snapshot is byte-for-byte current for the complete context;
- G1, G2 and the Advisor context have identical orientation;
- G1 and G2 preserve the same ordered feature identity, kind and native references;
- the Advisor report material matches the reviewed context;
- exactly one report finding has the same stable feature ID, supported geometry kind and complete face-reference set.

Missing, mismatched or ambiguous associations are displayed as **not assessed**. Non-hole geometry is also **not assessed**. `NOT_COVERED` appears only when it is actually present in a successfully associated authoritative feasibility finding.

## Freshness and invalidation

The existing `captureAdvisorContext()` / `isAdvisorContextCurrent()` contract covers verified source-content identity, orientation, stock mode and snapshot, WCS, material, tool records and capability revision. Any change invalidates the join. A filename or display mesh is never used as identity.

The inventory, classification, report, snapshot and overview are reactive values derived from the current context. When that context disappears or changes, the previous overview is not retained. There is no G3 persistence.

## UI terminology

The STEP Advisor inspector now separates:

- **Feature overview** — geometry kind, recognition state, qualitative confidence, measurements and native references;
- **Possible interpretations · not proven** — alternatives from G2 without automatic choice;
- **Unknown / open** — missing intent, setup/accessibility evidence and limitations;
- **Feasibility** — an independently matched existing Advisor assessment, or **not assessed**;
- **Feasibility · existing Advisor screen** — the pre-existing tool, cutting-data and proposal inspector.

No confidence percentages or generic “machinable” label are shown.

## Unavailable and error states

The integration fails closed with an explicit unavailable state when G1 or G2 fails, the verified current context or reviewed snapshot is missing, the feasibility report is absent, context freshness fails, or G1/G2 linkage is inconsistent. An unavailable feasibility screen can still show current geometry, but every feature is marked not assessed.

## Remaining limitations

- Feasibility remains limited to the existing drill and helical-mill screen.
- Blind/through termination, accessibility, collision freedom and tool suitability remain unresolved unless the existing feasibility source explicitly assesses them.
- Planar faces, contours, planar regions and unresolved boundaries receive no new machining feasibility claim.
- Pocket depth, removal side and contour inside/outside intent are not inferred.

## Acceptance evidence

`pnpm check:011g3` covers the complete G1 → G2 → Advisor pipeline, all six feature kinds, source-reference and ordering preservation, multiple interpretations, verified/missing/stale feasibility, unresolved boundaries, G1/G2 errors, full context invalidation, immutability and the absence of operation/toolpath/NC creation. The existing G1, G2, Advisor and production regression gates remain unchanged and are run as part of delivery QA.
