# Build 010-B — Semantic Guide Path

The guide builder accepts the 010-A operation contract and a DXF `Curve2[]` selection. It selects exactly the requested closed semantic contour ID, preserves native LINE/ARC segments and applies an outward signed offset of `tool diameter / 2 + radial allowance` for `outside`, or the negative of that value for `inside`. The source design contour remains separate from the derived cutter-center guide.

The result fails closed for missing/open/unsupported or discontinuous geometry, invalid contract inputs, collapsed arc radii, an offset rejected by the existing analytic offset validation, or an inverted/nonpositive signed area. The latter check catches an inside offset that folds a narrow rectangle over despite passing local offset-distance checks. It has no polygonal fallback. The guide is independent of depth, ramp placement, stock, and machine coordinates; callers provide the same coordinate transform to contour selection and offset construction.

**Release boundary:** A valid guide is only a necessary input to later stages. Existing offset validation checks local distance and continuity, not full material-side clearance, self-intersection, collision, ramp clearance, corner feasibility, or effective engagement. No production operation, persistence, preview, preflight, NC output, or G-code dispatch is enabled by 010-B. Those proofs remain prerequisites before manufacturing release.

Acceptance cases: outside and inside rectangle offsets, reversed winding, native LINE/ARC preservation, open/unknown/unsupported contours, collapsed inside offset and invalid entry contract.
