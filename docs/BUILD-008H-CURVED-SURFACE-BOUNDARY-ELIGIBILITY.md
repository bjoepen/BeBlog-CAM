# Build 008H — Curved Surface Boundary Eligibility

## Origin

The public beta exposed the contract gap first on the rounded edges of the new
Z-CAM / BeBlog camera grip and then with a minimal hemisphere STEP fixture.

Both are legitimate 3-axis top-machining surfaces, but OCCT triangulation may
contain XY-degenerate triangles where a smooth surface reaches a vertical
tangent at its BRep boundary.

## Hard contract

> Boundary singularities may be excluded from height-field interpolation only
> when they are proven to touch the boundary of the selected face. Interior
> degeneracy, overhangs and multi-Z ambiguity remain fail-closed.

008H does not relax the downstream machining safety contract.

## Classification

For all display triangles belonging to the selected BRep face:

1. Build an undirected 3D edge-use map from the selected-face triangulation.
2. Regular triangles with non-zero XY projection remain height-field triangles.
3. An XY-degenerate triangle may be excluded only if at least one of its
   topological edges is used by exactly one selected-face triangle.
4. An XY-degenerate triangle without such a boundary edge is an interior
   degeneracy and invalidates the target.
5. A target made only from degenerate triangles remains invalid.

Shared vertices are quantized only for deterministic topology matching. This
does not alter coordinates used for interpolation or toolpath generation.

## Preserved safety

The existing conservative rules remain unchanged:

- `curvedFaceTargetZAt()` never interpolates an XY-degenerate triangle.
- materially different Z hits at one XY position remain ambiguous and return
  `null`.
- curved flat-endmill roughing still requires the complete sampled cutter-bottom
  disk to resolve inside the selected target and above the target surface.
- ballnose finishing still requires a valid local top-machinable contact.
- Canonical Toolpath, 004T Safe Motion, Preflight, NC Motion Truth and
  postprocessor contracts are unchanged.

## Shared consumers

The repaired eligibility truth is shared by:

- Z-Level Schruppen / curved Face Target
- 3D Schlichten / ballnose surface finishing

There is no operation-specific hemisphere or fillet exception.

## Qualification

Automated gate:

`pnpm check:008h`

The gate protects the boundary-classification implementation, the interior
fail-closed path, the existing multi-Z rejection and the shared consumer path.

Real-world acceptance should include:

- the new camera grip rounded edge: target accepted and paths plausible,
- hemisphere fixture: target accepted,
- existing curved-face reference: unchanged,
- a true interior vertical fold / overhang fixture: rejected,
- Preview / Preflight / NC consistency for the accepted target.

