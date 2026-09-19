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


## 008H-B — Adjacent Surface Cutter Support

Real-world testing with the rounded camera-grip face showed a second, distinct
boundary condition: a valid flat-endmill disk may cross the selected face
boundary onto an adjacent part face.

For curved-face roughing, 008H-B therefore builds a conservative secondary
height-field from the complete placed part. A cutter-disk sample is resolved in
this order:

1. selected curved face,
2. complete-part top-surface fallback,
3. unresolved => unsafe / rejected.

The fallback is accepted only when the complete-part target itself passes the
same CurvedFaceTarget eligibility and single-valued checks. It does not turn an
unknown area into free space and does not bypass multi-Z ambiguity.

This is intentionally a roughing-only extension. 3D finishing contact remains
bound to the selected finishing face until a separate real-world need proves
that contact continuation across face boundaries is required.


## 008H-C — True 3D Z-Level Roughing

Real-world acceptance of 008H-A/B showed that making a selected curved face more
permissive was the wrong abstraction for ordinary 3-axis waterline roughing.
A hemisphere and the rounded camera-grip edges require the complete solid to be
the material/collision truth.

For non-planar face targets the manufacturing pipeline is now:

```
placed STEP/BRep solid
→ cutting Z level
→ solid slice (allowance-aware)
→ Stock − Model region
→ cutter-radius-safe planar raster
→ selected-face XY manufacturing scope
→ top-accessibility proof
→ Canonical Toolpath
→ 004T / Preflight / NC
```

Selected faces no longer act as an isolated collision surface. They define the
manufacturing scope and target depth. The complete placed STEP solid determines
where material exists and where the cutter may safely pass.

### Stock allowance

`finishAllowanceMm` is now explicit in the Z-Level UI. For true solid Z-level
roughing it is applied conservatively in three dimensions:

- cutting levels stop above the selected/model bottom by the allowance,
- solid slices are sampled lower by the allowance,
- XY cutter clearance uses the physical cutter diameter plus twice the allowance.

This deliberately leaves at least the requested stock envelope for a later
finishing operation; it does not reinterpret allowance as a simple display-only
or Z-only value.

### Acceptance fixtures

- hemisphere Ø20: plausible descending waterline roughing toward the reachable equator,
- Z-CAM wood grip V14: rounded multi-face transitions rough from complete-solid truth,
- allowance 0.00 / 0.50 / 1.00 mm changes remaining stock predictably,
- Ø3 / Ø6 changes reachability without weakening collision proof,
- overhang/undercut remains top-accessibility fail-closed,
- Preview / Preflight / NC consume the same canonical toolpath.


## 008H-D — Geometric Selected-Face Scope

A stock-height real-world test exposed that the first True-Z-Level implementation
used the rectangular XY bounds of all selected faces as manufacturing scope.
That can include unrelated material between disjoint fillets and is not an
acceptable interpretation of face selection.

008H-D removes the rectangular scope. Safe complete-solid raster segments are
now intersected with the actual XY projection of the selected BRep-face
triangulation. Each straight raster segment is split at projected selected-face
triangle edges and every resulting interval is classified against the union of
the selected face projections.

The responsibility split is therefore explicit:

- **Stock**: where removable material exists.
- **Complete STEP/BRep solid**: what is collision-safe and must remain.
- **Selected BRep faces**: where this face-target Z-Level operation is allowed to
  machine.

The complete-solid safety proof remains upstream of selection clipping.
Selection can reduce a proven-safe path, never make an unsafe path legal.

The 008H contract gate explicitly rejects a return to rectangular
`clipToolpathToXY` face scoping.


## 008H-E — Stock Edge Is Not a Collision Wall

A stock-to-part-size real-world test exposed a second boundary-classification
error. The planar raster kernel correctly keeps a cutter radius away from every
roughing-region boundary, but the temporary Stock−Model region also used the
physical stock rectangle as its outer boundary. That incorrectly treated a
stock edge like protected model geometry.

For 3-axis roughing this is too strict: the cutter may safely overhang the
physical stock edge when machining model geometry that reaches that edge.

008H-E therefore distinguishes the two meanings:

- **model boundary**: protected by cutter radius plus finishing allowance,
- **stock boundary**: material ends here; it is not itself a collision wall.

The temporary raster domain is extended beyond the physical stock before the
existing cutter-radius erosion. This permits up to one clearance radius of
cutter-centre overhang beyond the real stock while leaving the model-side
clearance proof unchanged.

This specifically covers the acceptance case where stock XY dimensions equal
the part XY dimensions. Such a setup must not suppress an otherwise reachable
rounded edge merely because the tool centre has to pass outside the stock.


## 008H-F — Face Selection Is Cutter-Contact Intent

The stock-edge correction alone did not make a stock-to-part-size rounded grip
machinable. The remaining failure exposed a separate semantic error in 008H-D:
selected-face scope required the **tool centre** to lie inside the XY projection
of the selected face.

That is incorrect for convex fillets, hemispheres and other outside curvature.
The cutter can contact a selected face while its centre lies outside that face
projection—and, legitimately, outside the physical stock.

008H-F therefore defines selected faces as **cutter-contact intent**. A
solid-proven-safe cutter centre belongs to the face scope when its XY position
is within the contact radius (physical cutter radius plus finishing allowance)
of the actual projected selected-face triangulation.

The implementation tests the union of projected selected triangles plus their
edge-distance envelope. Straight raster segments are sampled and their
inside/outside transitions are bisected to preserve contact-scope boundaries.

Safety ordering remains unchanged:

1. complete-solid Stock−Model roughing proves a path safe,
2. model clearance uses cutter radius plus allowance,
3. stock edges permit legal cutter overhang,
4. selected-face contact scope may only remove portions of that safe path.

Thus expanding face intent cannot legalize a collision. It only prevents valid
convex-surface cutter positions from being discarded because the cutter centre
is not geometrically inside the selected CAD face.
