# Build 010-F5 — Canonical Multi-Depth Motion Chain

F5 converts the accepted F4 multi-depth reference into one explicit canonical 3D machine-motion chain. It does not add new cutting geometry or relax any F3/F4 proof. F3 startup remains spatial, while bootstrap, bridge and protected contour semantics are lifted to the absolute Z depth of their F4 level.

Every lifted line becomes `line3`; every native semantic arc becomes `arc3` with its original center and winding. Cutting motions remain feed-bearing canonical spatial segments. F4 lateral Safe-Z positioning is represented as `rapid3` only when both endpoints are exactly at Safe-Z. Vertical Safe-Z-to-surface approach and depth-to-Safe-Z retract remain feed-bearing `line3` motions.

F5 validates exact XYZ continuity inside every level and across level boundaries before returning the flattened chain. Any inherited F4 failure or any discontinuity rejects the complete result with empty level and motion arrays.

Acceptance covers transformed native circle/capsule guides, inside/outside and both loop windings, exact shortened final depth, immutable inputs, global XYZ continuity, native `arc3` presence at exact level Z, Safe-Z-only rapids, no unnecessary first-level lateral rapid, later-level Safe-Z positioning and inherited atomic rejection.

Release boundary: F5 is canonical reference geometry, not NC release. Rapid classification only proves the planned Z relation to the workpiece surface; fixture/clamp clearance remains external. Machine dynamics, cutter cutting length, stock topology, job/UI/persistence/preflight integration, postprocessing and controller execution remain open.
