# Build 010-D — LINE/ARC Path Following

The isolated reference generator parameterizes contiguous semantic LINE/ARC primitives by exact arclength. `stationAtLength` returns the native point and tangent; the local free-side normal places each 010-C two-arc loop. Stations follow the *whole* mixed guide, not a sampled polyline. An open guide includes both endpoints and uses a shortened final interval; a smooth closed guide has no duplicate terminal loop and links its last free-side apex to the first.

The metric rejects non-finite/degenerate geometry, arc-radius mismatches, gaps, and non-tangent joins (including a sharp closing seam). A 90° corner therefore remains unavailable until the explicit 010-E corner policy. A single straight segment reproduces 010-C output byte-for-byte in the acceptance fixture.

**Release boundary:** A geometrically smooth source is not a clearance proof. Local loop circles or apex links can still cross the protected contour elsewhere, collide with stock, exceed available curvature, or cause full-slot engagement. Closed-loop linking is only a candidate geometric connection. 010-D adds no operation, ramp, UI, preview, preflight, persistence or NC dispatch. All paths remain non-manufacturing reference geometry pending boundary/corner/engagement proofs.
