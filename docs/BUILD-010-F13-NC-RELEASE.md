# Build 010-F13 — Trochoidal NC Release

F13 qualifies the existing 004T total-job postprocessor as the NC release path for trochoidal contour roughing.

## Authority chain

`TrochoidalContourOperationState -> Job Preflight -> 004T materialized CanonicalToolpath.motions -> postCanonicalMachineMotions -> total-job NC`

There is no trochoid-specific legacy G-code reconstruction. The existing operation-level generator remains fail-closed for trochoidal contour roughing.

## Release acceptance

The F13 acceptance proves a stock-bottom job with intentional spoilboard overcut:
- 6.0 mm stock + 0.3 mm overcut with 0.5 mm spoilboard reserve
- exact final canonical and NC depth Z-6.300
- Safe-Z rapid motions remain G0
- pendulum ramp/spatial linear motions remain G1 with canonical/default feed semantics
- trochoidal arcs remain G2/G3
- spindle start and program termination are present
- every materialized canonical operation motion is emitted once and in canonical order

F13 does not alter geometry, physical cut direction, depth resolution, spoilboard clearance or safe-motion generation.
