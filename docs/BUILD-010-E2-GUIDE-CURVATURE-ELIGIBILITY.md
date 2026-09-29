# Build 010-E2 — Guide Curvature Eligibility

010-E2 takes a real 010-B semantic guide and validates that it forms a closed, G1-tangent LINE/ARC route. Signed area of the source contour determines its interior side; `inside`/`outside` then determines the loop's free side, including clockwise winding. A hard corner or non-tangent closure is rejected.

If an offset arc bends toward the free side, the requested loop radius is conservatively reduced **uniformly** to at most that arc's radius. The tightest such arc wins. The resulting radius must remain above the explicit minimum and keep `forwardStep <= 2 × radius`; otherwise the plan fails. This returns a candidate uniform radius and geometric free side, not a toolpath or a local variable-radius strategy.

Acceptance uses 010-B's actual capsule offset: outside keeps the requested radius, inside is limited by its smaller offset arc. Reversed winding preserves the physical outside side. A rectangle fails at its sharp corners; a narrow inner capsule fails below minimum radius.

**Release boundary:** A tangent guide and locally plausible radius do not prove global cutter-envelope clearance, apex-link clearance, material engagement, corner rounding, or ramp safety. 010-E2 does not enable operation, preflight, persistence, preview or NC output. Any eventual use of the reduced radius must regenerate the candidate path and prove every segment against the protected domain.
