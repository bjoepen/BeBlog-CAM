# Development 011-G1 — STEP Manufacturing Feature Inventory

## Result

011-G1 adds a pure, deterministic, read-only inventory over the existing exact STEP/BRep manufacturing topology. It does not change the Advisor UI, Advisor report, operation creation, toolpaths, preflight, STEP import, or application version.

## Recognition coverage

- Holes and rejected cylinders come directly from `recognizeStepHoles()`; rejected cylinders stay explicitly unclassified.
- Closed and supported open contour wires come directly from `buildStepContourTargets()`.
- Planar faces are listed as geometric candidates requiring interpretation, never as inferred facing or pocket operations.
- Bounded planar regions and contained islands reuse the same pure extraction now exported as `buildStepPocketCandidates()` and still used by production pocket planning.
- Native face, wire and edge identities are retained. Coordinates and directions use the supplied part orientation.

## Safety and limitations

Inventory entries are geometric evidence, not manufacturing claims. They do not establish tool access, material side, collision freedom, machining intent, or approval. Unsupported or incomplete BRep topology fails closed. Production selection remains unchanged: contour requires `stepWireId`, pocket requires `stepFaceId`, and drill/helical milling requires `stepHoleFeatureIds`. Every adopted operation must still pass its existing preflight and production gates.

## 011-G2 consumption boundary

011-G2 can call `buildStepManufacturingFeatureInventory(summary, orientation)` and render or further assess the typed entries. It should bind any derived report to the existing Advisor geometry/setup context, treat `classification` and `limitations` as authoritative disclosure, and map candidates to user actions only through the existing explicit-selection contracts. It must not translate an inventory entry directly into a toolpath or operation.

## Focused gate

Run `pnpm check:011g1`. The gate covers recognized and rejected cylinders, closed/open contours, planar regions and islands, non-inferred planar intent, orientation, invalid topology, determinism, immutability, unchanged selection requirements, and absence of toolpath output. Existing `pnpm check:011b` protects unchanged Advisor results.
