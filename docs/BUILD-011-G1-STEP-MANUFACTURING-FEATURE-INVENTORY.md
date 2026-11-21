# Development 011-G1 — STEP Manufacturing Feature Inventory

## Result

011-G1 adds a pure, deterministic, read-only inventory over the existing exact STEP/BRep manufacturing topology. It does not change the Advisor UI, Advisor report, operation creation, toolpaths, preflight, STEP import, or application version.

## Recognition coverage

- Holes and rejected cylinders come directly from `recognizeStepHoles()`; rejected cylinders stay explicitly unclassified.
- Closed and supported open contour wires come directly from `buildStepContourTargets()`.
- Planar faces are listed as geometric candidates requiring interpretation, never as inferred facing or pocket operations.
- Bounded planar regions and contained islands reuse the same pure extraction now exported as `buildStepPocketCandidates()` and still used by production pocket planning.
- Native face, wire and edge identities are retained. Coordinates and directions use the supplied part orientation.
- Cylinder entries expose complete face topology references. Recognized holes additionally expose a separate recognition-evidence reference set for the two circular boundaries used by `recognizeStepHoles()`.

## 011-G1a evidence corrections

- **Native closure:** inventory contour and region publication now verifies the reconstructed chain's actual first/last endpoints within the established `1e-4 mm` geometric tolerance. A native `closed` flag cannot manufacture a closing segment; valid single-edge closed circles and supported open contours remain available.
- **Boundary completeness:** every wire on a horizontal planar face is reconciled with existing contour reconstruction. Unsupported curves, reconstruction failures, geometric closure mismatches and plane-inconsistent boundaries become `unresolved-boundary` entries with native references. A region is published only when every native closed wire is reconstructed and represented, so incomplete regions expose no misleading area or island count.
- **Horizontal evidence:** region publication requires the established strict horizontal-normal tolerance (`1e-5`) and verifies boundary endpoints, circle centers and circle axes against the oriented constant-Z plane. Tilted faces remain in the planar-face inventory but cannot publish projected XY region measurements.
- **Cylinder topology:** recognized and rejected cylinders now retain deterministic, deduplicated native wire and edge references. Hole recognition semantics are unchanged, and recognition-only circular references are distinct from complete face topology.

## Safety and limitations

Inventory entries are geometric evidence, not manufacturing claims. They do not establish tool access, material side, collision freedom, machining intent, or approval. Unsupported or incomplete BRep topology fails closed or remains explicitly unresolved without complete-region measurements. Production selection remains unchanged: contour requires `stepWireId`, pocket requires `stepFaceId`, and drill/helical milling requires `stepHoleFeatureIds`. Every adopted operation must still pass its existing preflight and production gates.

## 011-G2 consumption boundary

011-G2 can call `buildStepManufacturingFeatureInventory(summary, orientation)` and render or further assess the typed entries. It should bind any derived report to the existing Advisor geometry/setup context, treat `classification` and `limitations` as authoritative disclosure, and map candidates to user actions only through the existing explicit-selection contracts. It must not translate an inventory entry directly into a toolpath or operation.

## Focused gate

Run `pnpm check:011g1`. The gate covers recognized and rejected cylinder topology, valid and falsely closed chains, a single-edge circle, open contours, multiple islands, unsupported outer/inner boundaries, unresolved native references, strict orientation and constant-plane evidence, invalid topology, determinism, immutability, unchanged production candidate behavior and selection requirements, and absence of toolpath output. Existing `pnpm check:011b` protects unchanged Advisor results.
