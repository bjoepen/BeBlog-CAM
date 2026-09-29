# Build 010-E3 — Capsule Boundary Proof

010-E3 recognizes a closed, G1-tangent four-segment capsule guide: two parallel lines and two outward semicircles of equal radius. The interior is exactly the set of points no farther than that radius from the segment joining the arc centers. Outside is the complement. Unsupported contours fail closed.

The proof computes extrema of distance to this finite spine over **every** native candidate LINE/ARC segment. It accounts for line intersections and interior minima, and for arc angular extrema and transitions from endpoint-distance regions to the perpendicular-distance region. Both loop arcs and free-side links are checked. A result on the selected side proves the protected cutter-center boundary for this capsule only.

Acceptance composes an actual 010-B capsule offset with 010-E2's chosen free side/radius and 010-D's candidate path, for inside and outside, rotated geometry and reversed winding. Counterexamples include a chord and an arc whose endpoints are safe while their interiors cross the protected side. Rectangles and other unsupported shapes fail.

**Release boundary:** The guide is assumed to be derived from the correct design contour and tool offset by 010-B. 010-E3 does not prove that apex links travel in previously cleared stock, limit effective radial engagement, or provide safe ramp, tool/holder collision, corner handling, or a general contour domain. No manufacturing operation, UI, preflight or NC dispatch is enabled.
