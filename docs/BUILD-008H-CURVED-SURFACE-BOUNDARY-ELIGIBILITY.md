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


## 008H-G — Raster Direction: Auto / X / Y

The rounded-grip acceptance fixture showed that a geometrically valid Z-Level
path can still be a poor manufacturing strategy when the raster is fixed to one
axis. Across the long grip fillets, the wrong axis creates many short,
fragmented cuts instead of long continuous passes.

Z-Level roughing therefore exposes three persisted choices:

- **Auto** (default)
- **Parallel X**
- **Parallel Y**

X and Y are deterministic user overrides. Auto does not infer direction merely
from the stock or model bounding-box aspect ratio. It builds both complete
candidates through the same solid safety, selected-face cutter-contact scope,
and top-accessibility checks.

Auto then chooses:

1. a valid candidate over an invalid candidate,
2. fewer canonical runs (less fragmentation),
3. if run counts tie, greater mean connected cutting length,
4. X only as the final deterministic tie-break.

The chosen direction and both candidate metrics are emitted as an 008H-G
diagnostic warning in Preflight. Direction changes only raster strategy; it does
not alter Stock−Model truth, cutter clearance, allowance, face-contact scope or
004T/004Q safety contracts.


## 008H-H — Per-Face Auto Raster Direction

The grip fixture proved that one global Auto direction is insufficient when a
single operation selects orthogonal faces. Long side fillets prefer one raster
axis while short end fillets prefer the other.

For **Auto** only, each selected BRep target face is now reconstructed as an
independent cutter-contact scope. X and Y candidates are built for that face
through the same complete-solid safety, contact clipping and top-accessibility
checks. The local winner uses the existing deterministic rule: fewer canonical
runs, then greater mean connected cutting length, then X as final tie-break.

The accepted runs from all selected faces are combined into one canonical
raster toolpath. Preflight reports the chosen direction and candidate metrics
for every target face.

Manual **Parallel X** and **Parallel Y** intentionally remain global overrides.
No local decision can bypass Stock−Model truth, cutter clearance, allowance,
004T motion truth or 004Q assembly checks.


## 008H-I — Face Contact Radius vs. Solid Allowance

Real-world testing with the Z-CAM grip exposed a semantic overlap: the solid
roughing geometry already applies finish allowance conservatively, while the
selected-face contact scope also used `tool radius + allowance`. That enlarged
the selection envelope a second time and could retain paths visibly displaced
from the intended rounded surface.

The contracts are now separated:

- **complete STEP solid** owns material truth, collision clearance and finish allowance;
- **selected BRep face** owns only cutter-contact intent;
- the face-contact envelope therefore uses the **physical cutter radius only**;
- stock-edge overhang and downstream 004T/004Q safety remain unchanged.

This is intentionally a narrow correction. It does not weaken solid safety and
does not invent additional toolpath geometry; it can only reject portions of an
already solid-safe canonical candidate that do not physically reach a selected
face.


## 008H-J — Z-local selected-face ownership

The V14 grip remained asymmetric after separating finish allowance from the
face-contact radius. The root problem was therefore not another tolerance:
selected steep/rounded faces were still represented by their complete global
XY projection at every cutting level.

Face selection is now evaluated **per canonical Z-level**. For each cutting
run, only triangles of the selected BRep face whose vertical extent can
physically participate within one cutter radius of that Z are admitted to the
contact scope. The already complete-solid-safe canonical run is then clipped
against that Z-local scope.

This changes ownership, not safety:

- complete STEP solid remains the source of Stock−Model and clearance truth;
- finish allowance remains exclusively in the solid safety envelope;
- selected faces only filter already-safe motion;
- manual X/Y and per-face Auto use the same Z-local contact rule;
- 004T and 004Q remain downstream and unchanged.

Acceptance fixture: the two opposite long and two opposite short rounded faces
of the Z-CAM V14 grip must produce geometrically symmetric machining where the
STEP geometry is symmetric. A single remote fragment on one opposite face is a
Real-World FAIL.


## 008H-K — Native Face/Z Slice Ownership

A read-only audit after the V14 real-world failure found that 008H-J still fed a
Z-filtered subset of whole 3D face triangles into the old projected-XY clipping
kernel. It therefore improved the input without removing the wrong geometric
model.

008H-K removes that CAM path. The existing solid slicer now exposes a second,
face-aware primitive: triangle/plane intersections retain their native
`displayFaceIds` ownership. Selected-face roughing consumes those actual 2D
intersection segments on the **same allowance-shifted Z plane** used to create
the Stock−Model region.

Contract:

- complete-solid Z slice remains material and collision truth;
- selected-face scope is derived from native face/Z intersection segments, not
  projected 3D triangles;
- finish allowance remains part of the solid clearance envelope;
- because the safe cutter centre intentionally remains one allowance away from
  nominal geometry, ownership accepts `tool radius + allowance` around the
  true face/Z segment; this filter can only remove already-safe motion;
- the old projected-face contact functions are forbidden by the 008H gate;
- manual X/Y and per-face Auto consume the same face/Z ownership truth;
- 004T and 004Q remain unchanged downstream.

The V14 opposite-face fixture remains the acceptance test: corresponding
opposite faces must yield corresponding machining regions. Remote fragments,
one-sided disappearance or ownership based on a global XY shadow are FAIL.


## 008H-L — Contract Reset: Face-owned Roughing Regions

**This section supersedes the Face-target scoping assumptions from 008H-F
through 008H-K.** Those iterations treated a selected Face as a contact envelope
used to clip an already generated whole-model toolpath. Real-world testing with
the V14 grip proved that abstraction wrong and it is no longer part of the
Z-Level Face-target implementation.

New invariant:

> A selected Face owns Stock−Model material on each Z section. It does not clip
> an already generated canonical toolpath.

For every allowance-shifted solid Z slice:

1. the complete STEP solid creates the ordinary Stock−Model roughing region;
2. the same native BRep triangulation is sliced with `displayFaceIds` retained;
3. every safe Stock−Model sample is assigned to its nearest native boundary
   segment on that Z section;
4. material whose nearest boundary belongs to a selected Face is the Face-owned
   roughing region;
5. raster X/Y is generated **inside that owned material region**;
6. cutter clearance, finish allowance, top accessibility, 004T and 004Q remain
   independent safety truths.

This is a partition of removable material, not a cutter-contact corridor.
Therefore material may extend from the selected model boundary all the way to
the stock boundary when that Face remains the nearest target boundary.

Implementation consequences:

- no generated canonical toolpath is post-clipped by selected Faces;
- projected 3D Face envelopes and cutter-contact radii are not CAM scope;
- the raster kernel accepts a region predicate and applies it to both raster
  samples and stay-down connectors;
- Auto may still choose X/Y per selected Face, but both candidates are generated
  from that Face's owned material region;
- manual X/Y over multiple selected Faces uses the union of their ownership.

The V14 grip remains the primary real-world acceptance fixture. Corresponding
opposite rounded Faces must own corresponding Stock−Model regions and produce
corresponding safe roughing paths. One-sided disappearance, isolated contact
fragments or projected-Face behaviour are FAIL.


## 008H-M — Native bounded outward ownership

The Headstock single-Hohlkehle fixture disproved the nearest-Face partition used
by 008H-L: a selected concave Face could become the nearest boundary for large,
unrelated Stock−Model areas.

008H-M therefore removes nearest-Face/Voronoi ownership.

For every selected Face/Z section segment the CAM now retains the outward
direction derived from the OCCT Face orientation and the oriented triangle that
produced that section. A removable Stock−Model sample belongs to that Face only
when:

- its orthogonal projection lies between the native section endpoints; and
- it lies on the Face's outward/material side.

The section endpoints are ownership boundaries. Material beyond them belongs to
adjacent BRep geometry and cannot leak into the selected Face merely because it
is geometrically nearer.

The complete STEP solid remains the clearance and accessibility truth. This
ownership rule only restricts which already-removable Stock−Model material may
be rastered; it never post-clips a canonical toolpath.

Acceptance fixtures are deliberately complementary:

- V14 grip: selected outer fillets must retain the material strip from each
  fillet toward the stock boundary.
- Headstock: selecting only the Hohlkehle must not claim the broad headstock
  exterior.


## 008H-N — Read-only architecture audit: Native OCCT CAM Region

Status: **AUDIT / CONTRACT DRAFT — no implementation yet**

### Trigger

Real-world fixtures disproved both heuristic Face-target ownership models:

- 008H-L nearest-Face ownership happened to look plausible on the V14 grip but
  allowed a single Headstock Hohlkehle to claim a broad unrelated exterior area.
- 008H-M bounded outward ownership still did not isolate the Hohlkehle correctly.

Therefore 008H-L/M are not acceptable CAM semantics. They remain historical
evidence only and must not be extended with another ownership heuristic.

### Repository audit

The native STEP adapter already has the correct source of truth:

- `src-tauri/native/occt_bridge.cpp` loads STEP with `STEPControl_Reader`
  and retains a real `TopoDS_Shape`.
- Native Face identity is stable inside one inspection pass: Faces are enumerated
  in the same order used for `manufacturingFaces` and `displayFaceIds`.
- Native topology is already available through `TopoDS_Face`, Wires and Edges.
  The bridge exports manufacturing Faces/Edges/Wires, but only as summaries.
- `BRepMesh_IncrementalMesh` is currently used to export display triangles.
  The TypeScript Z-Level path then reconstructs slices from those triangles.
- The bridge currently exposes only one native entry point:
  `beblog_occt_inspect_step(path)`. The real `TopoDS_Shape` is not retained
  across calls and no native CAM-region operation exists.
- `src-tauri/src/lib.rs` exposes only `inspect_import` for STEP geometry.
  CAM generation itself is synchronous TypeScript.
- `modelRoughingOperation.ts` therefore receives an `ImportSummary`, not a
  native Shape handle or native planar CAM region.
- `modelSliceRegion.ts` / `roughingRegion.ts` are valid downstream planar
  topology consumers, but their current input is reconstructed mesh slicing.
- `modelRoughingToolpath.ts` and `planarRasterKernel.ts` are downstream path
  generators and do not need to know BRep ownership if the input region is
  already authoritative.

### Root cause

The architecture crosses the geometry-kernel boundary too early:

```
TopoDS_Shape
   ↓
display triangulation
   ↓
TypeScript reconstructs model/Face topology
   ↓
heuristic Face ownership
   ↓
raster
```

This makes display geometry perform a manufacturing-kernel job.

### New hard invariant

> **OCCT constructs Face-target CAM geometry. TypeScript consumes the resulting
> planar machining region. No TypeScript predicate infers BRep Face ownership.**

The complete STEP BRep remains material/collision truth. Selected Face IDs are
native subshape identity, not display-mesh proximity.

### Proposed native boundary

Add a dedicated native CAM-region entry point rather than expanding
`inspect_step`:

```text
beblog_occt_build_zlevel_regions(
    STEP source path,
    selected Face IDs,
    orientation,
    placement,
    stock,
    Z levels,
    finish allowance
) -> per-Z planar regions
```

The exact C ABI may use one JSON request/response string to keep the existing
Rust/C++ bridge simple and versionable.

The native side must reload the STEP source deterministically, map Face IDs by
the same enumeration contract as inspection, apply the manufacturing transform,
and perform the exact BRep/planar operations before any tessellation is involved
in CAM truth.

### Region response contract

Per Z level, return only manufacturing geometry:

```text
{
  z,
  valid,
  islands: [
    {
      outer: [{x,y}, ...],
      holes: [[{x,y}, ...], ...]
    }
  ],
  errors: [],
  warnings: []
}
```

This intentionally mirrors the useful part of `RoughingRegion`, so the
existing raster/toolpath/safety pipeline can remain downstream.

The response must not contain:

- raster samples;
- canonical toolpaths;
- nearest-Face ownership;
- display-triangle IDs;
- contact-envelope predicates.

### Native geometric responsibility

For every requested cutting level OCCT owns:

1. exact STEP/BRep source and selected `TopoDS_Face` lookup;
2. part orientation and placement before manufacturing geometry is derived;
3. exact Z section / projection needed by the roughing strategy;
4. selected-Face target boundary and adjacent native topology;
5. Stock−Model material-domain construction for that target;
6. planar boolean/topological cleanup and closed outer/hole loops;
7. fail-closed validation of open, ambiguous or invalid regions.

Tool diameter is deliberately **not** part of Face ownership. Tool-radius
clearance and finish allowance must have one explicitly documented owner. For
the first N implementation, finish allowance may remain in the existing
downstream clearance model if and only if the native region represents nominal
material ownership. It must not be applied once natively and again in
TypeScript.

### TypeScript responsibility after N

TypeScript owns:

- operation parameters and UI;
- choosing requested Z levels;
- receiving authoritative planar regions;
- raster X/Y/Auto strategy;
- physical tool-radius clearance inside the supplied region;
- stay-down connector proof;
- Canonical Toolpath construction;
- top accessibility;
- 004T / 004Q / Preview / Preflight / NC truth.

TypeScript no longer owns:

- `sliceFaceSegmentsAtZ` for Face-target scope;
- `faceOwnedMaterialPoint`;
- `faceExtrudesToMaterial`;
- nearest-Face or outward ownership;
- any post-toolpath Face clipping.

Those helpers may remain temporarily only for historical/non-N consumers while
the migration is staged; the final N gate must forbid them in the Face-target
roughing path.

### Synchronous architecture warning

Current canonical toolpath construction is synchronous TypeScript, while a
Tauri native command is asynchronous. Therefore N must not hide an async native
call inside `buildModelRoughingOperationState()`.

The implementation needs an explicit data-flow boundary, for example:

```
source/setup/operation changes
        ↓
async native region request
        ↓
cached NativeZLevelRegionSet keyed by
source identity + transform + stock + Face IDs + Z levels
        ↓
synchronous canonical toolpath consumer
```

Editing must not recreate the 008E performance regression. Expensive native
region construction should be demand-gated/cached and invalidated only by
geometry-affecting inputs.

### Link/build audit

The current native build links the OCCT core, BRep, geometry, topology, mesh and
STEP libraries. Native boolean/section implementation may require additional
OCCT toolkit symbols. `src-tauri/build.rs` must be updated only for libraries
actually required by the chosen OCCT APIs; packaging 008F must then re-run its
dependency-closure test so the DMG remains portable.

### Acceptance fixtures

N is not PASS from unit/gate success alone.

**V14 Grip**
- selected rounded Faces produce the corresponding removable material regions;
- regions may extend to the stock boundary where geometrically appropriate;
- opposite Faces remain symmetric;
- no contact fragments / comb artefacts / unexplained zero-path result.

**CBG Headstock**
- select only the Hohlkehle;
- the native debug region itself must be limited to the Hohlkehle target;
- broad exterior material is not part of that region;
- this must be verifiable before raster generation.

A debug view of the native region is required for qualification. If the region
is wrong, raster, Canonical Toolpath and 004T are not investigated.

### Migration plan

**N1 — Native contract only**
- request/response Rust + TypeScript types;
- C ABI declaration;
- deterministic Face-ID mapping contract;
- no CAM consumer switch.

**N2 — Native region construction**
- exact OCCT section/planar boolean implementation;
- fail-closed topology validation;
- native fixture/gate where available.

**N3 — Region integration**
- async cache/data-flow;
- convert native region response to existing `RoughingRegion`;
- remove Face ownership predicates from raster path.

**N4 — Qualification**
- native-region debug rendering;
- V14 Grip;
- CBG Headstock Hohlkehle;
- complete regression suite including 004Z/004T/004Q and native packaging.

### Explicit non-goals

008H-N does not redesign Canonical Toolpath, 004T, 004Q, the postprocessors or
the general raster kernel. It moves BRep manufacturing-region construction back
to the geometry kernel where it belongs.


## 008H-N1 — Native Contract

Status: **IMPLEMENTED — contract only**

N1 freezes the wire boundary before any native geometry algorithm is introduced.

Contract version: `008H-N1-v1`.

The request contains source path + source fingerprint, native Face IDs,
manufacturing transform, stock, requested Z levels and finish allowance. The
response contains only per-Z planar manufacturing regions (outer loops + holes),
errors and warnings.

Face IDs are explicitly defined as the zero-based
`TopExp_Explorer(shape, TopAbs_FACE)` enumeration order. This is the same
identity already exported by `manufacturingFaces.faceId` and
`displayFaceIds`.

The C ABI now reserves `beblog_occt_build_zlevel_regions(request_json)`, and
Rust/TypeScript mirror the request/response schema. There is intentionally no
Tauri command and no production CAM consumer yet: N1 must not make an
unimplemented/stub native geometry path executable.

N2 is responsible for the actual OCCT region construction and may only then
expose the command after fail-closed native validation exists.


## 008H-N2 — Native OCCT section kernel, increment 1

Status: **IMPLEMENTED / CI pending / not yet a CAM consumer**

The N1 wire contract is now executable. Rust serializes the versioned request to
the native bridge and validates the versioned response. Tauri exposes
`build_native_zlevel_regions`, but the existing production Z-Level roughing
operation is intentionally not switched yet.

The native C++ bridge now:

1. reloads the STEP BRep with OCCT;
2. resolves selected Face IDs using the same zero-based native Face enumeration;
3. builds a compound from the selected `TopoDS_Face` objects;
4. applies the requested X/Y/Z manufacturing rotation and translation;
5. intersects that native selected-Face shape with each requested Z plane using
   `BRepAlgoAPI_Section`;
6. samples the resulting OCCT section curves into ordered planar chains;
7. emits only chains that can be proven closed; open/ambiguous sections fail
   closed.

No `displayVertices`, `displayFaceIds` or TypeScript triangle reconstruction
participates in this native region builder.

This is deliberately the **first N2 increment**, not N2 completion. A closed
Face/Z section is a useful native geometric primitive, but it is not yet the
complete Face-owned Stock−Model material domain required by the final contract.
The next N2 increment must construct the planar material region/boolean from
native BRep topology. Until that exists, N3 must not connect this response to
the production raster kernel.

The new gate therefore proves the architecture boundary and fail-closed
behavior, not real-world Hohlkehle correctness.
