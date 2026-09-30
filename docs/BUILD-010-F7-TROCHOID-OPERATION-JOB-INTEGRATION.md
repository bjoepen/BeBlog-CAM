# Build 010-F7 — Trochoidal Operation / Job Integration

F7 promotes the accepted trochoidal contour contract from an isolated geometry contract to a stable CAM operation and routes it into the existing canonical production path.

Scope is intentionally narrow: DXF, one closed contour, inside/outside, end mill, top-Z WCS. STEP, open/broken contours and bottom-Z WCS fail closed.

The production adapter reconstructs the same placement/orientation/WCS transform used by 2D contour machining, builds the accepted semantic trochoidal guide, and delegates all cutting geometry to the F6 canonical toolpath package. No second trochoidal geometry implementation is introduced.

The operation is registered in the project operation union, creation/summary path and active canonical toolpath router. Job preflight reconstructs the F7 toolpath and then applies the existing 004T safe-motion materialization, canonical validation, stock simulation, tool-assembly, fixture, spindle-head and machine-envelope checks.

The F6 global motion chain remains authoritative. F7 does not add a dedicated NC postprocessor or UI editor. Those remain later release steps.

Acceptance proves stable operation identity, transformed DXF placement, exact F6 depth schedule, active-toolpath parity, 004T job-preflight materialization, immutable inputs and fail-closed rejection of STEP, bottom-Z WCS and invalid operation identity/target.
