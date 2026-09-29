# Build 010-E1 — Circular Boundary Proof

This first 010-E safety slice measures the **exact radial extrema** of each native LINE/ARC candidate motion against a circular cutter-center guide. Outside requires every point at or beyond the guide radius; inside requires every point at or within it. The proof includes links, not only loop arcs, and rejects gaps, open candidate paths and invalid primitives. A chord can cross the protected side even when both endpoints are safe; an arc can do the same between safe endpoints. Both have acceptance fixtures.

The domain is the *cutter-center guide*, assumed to have already been derived from the authoritative design circle using cutter radius and radial allowance. 010-B does not yet support a native DXF circle, so 010-E1 uses a synthetic semantic circle fixture. It is not integrated into the operation pipeline.

**Release boundary:** This is only a circular protected-side check. It does not prove stock removal, radial engagement/full-slot avoidance, ramp clearance, corner handling, collision, or arbitrary LINE/ARC contour safety. Any unsupported shape remains unproven and cannot be manufactured through this module. No UI, persistence, preflight or NC dispatch is enabled by 010-E1.
