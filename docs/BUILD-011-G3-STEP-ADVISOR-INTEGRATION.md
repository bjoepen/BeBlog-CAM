# Build 011-G3 — STEP Feature Advisor Integration

## Scope

011-G3 adds a read-only feature overview to the existing STEP Advisor inspector. It does not create operations, select geometry, generate toolpaths or NC, change production preflight, or alter the application version.

## Architecture and data flow

While the **Prüfen** step is active, `App.svelte` creates the existing verified `AdvisorContext` from the imported source-content SHA-256, orientation, stock, WCS, material, tool library and capability revision. It also computes two deliberately separate reactive pipelines:

1. `buildStepAdvisorGeometryPipeline(importSummary, orientation)` computes the G1 STEP manufacturing feature inventory and G2 feature classification from geometry inputs only;
2. the Advisor pipeline computes the existing `screenStepFeasibility()` report and its exact full-context reviewed snapshot.

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

G1/G2 recomputation is narrower: the Svelte reactive statement references only the verified imported STEP summary, part orientation and whether the review step is active. Tool-library, material, stock, WCS and capability-revision changes rebuild the Advisor report and invalidate/rejoin the overview, but do not rebuild unchanged geometry. A changed STEP summary or orientation does rebuild G1 and G2. Leaving and returning to **Prüfen** may recompute this transient geometry state; no cross-step or persistent cache is introduced.

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

`pnpm check:011g3` retains the isolated adapter cases and additionally executes a native STEP/BRep topology fixture through the actual production functions `buildStepManufacturingFeatureInventory()`, `classifyStepManufacturingFeatures()`, `screenStepFeasibility()` and `buildStepAdvisorFeatureOverview()`. The fixture contains a recognized hole, rejected cylinder, valid planar face/contours/region and a separate unsupported boundary. The gate verifies real feature IDs, measurements, native references, feasibility matching, out-of-scope `not-assessed` results, context invalidation and input immutability.

The gate also wraps the real G1/G2 producers with execution counters at the pure `createStepAdvisorGeometryPipeline()` boundary. It demonstrates that tool, material, stock, WCS and capability changes do not invoke those producers, while changed STEP geometry and orientation do. A source-level assertion confirms that the actual App reactive statement uses the same narrow dependency boundary.

Manual acceptance remains responsible for confirming the compact inspector layout, expansion behavior and terminology in the packaged application, and for observing that feature cards refresh/disappear correctly while interactively changing imports, orientation and Advisor inputs. The automated gates cover the underlying data, freshness and producer-execution contracts; they do not emulate a complete Tauri UI session.
