# Build 004A — STEP Manufacturing Feature Contract

## Goal

Create the exact BRep semantic boundary required to make STEP a first-class source for everyday 2.5D CAM operations.

004A does **not** yet generate drilling, helical boring, contour or pocket toolpaths. It exposes stable native STEP/BRep surface semantics that later builds can classify into machining features without using display triangulation as CAM truth.

## Why this build exists

Before 004A, the native OCCT bridge exposed:

- aggregate surface counts,
- a flat list of cylinder radii,
- tessellated display triangles with face IDs,
- sampled display edges.

That was enough for visualization and the 003 3D development, but not enough for a reliable STEP → 2.5D manufacturing workflow.

A radius alone does not identify a hole. A sampled display edge is not an exact contour. Therefore 004A introduces a dedicated manufacturing semantic source directly from native OCCT/BRep.

## Native BRep output

Every STEP face now receives a stable `faceId` using the same face enumeration contract used by the display face mapping.

The native bridge exports `manufacturingFaces`.

Every entry contains:

- `faceId`
- analytic surface `kind`
- BRep face `orientation`

Planar faces additionally contain:

- exact plane origin
- exact unit normal

Cylindrical faces additionally contain:

- exact cylinder axis origin
- exact unit axis direction
- exact radius in mm

Cone, sphere, torus and other surfaces are identified but deliberately do not receive invented 2.5D semantics.

## Frontend manufacturing boundary

`src/lib/stepManufacturingFeatures.ts` defines a controller-neutral STEP manufacturing source.

The source is valid only when:

- the import is STEP,
- native BRep is available,
- every BRep face has exactly one manufacturing semantic record,
- face IDs are unique,
- analytic vectors are finite and normalized,
- cylinder radii are positive.

The resulting source exposes exact planar and cylindrical face candidates separately.

## Hard architecture rules

```text
STEP
  ↓
OCCT exact BRep
  ↓
Manufacturing Face Semantics
  ↓
future Feature Recognition
  ↓
CAM Operations
```

The following are **not** CAM truth:

- display triangles,
- sampled display edges,
- viewport proof geometry.

STEP is not converted into pseudo-DXF.

DXF and STEP may later feed common CAM feature contracts, but they retain their native geometry sources.

## Deliberately not in 004A

004A does not yet classify:

- holes,
- through vs blind bores,
- coaxial cylindrical faces,
- planar pockets,
- outer contours,
- edge wires,
- machining accessibility,
- model-bottom / stock-bottom depth semantics,
- overcut below stock,
- holding tabs.

Those are subsequent 004 builds.

## Next build

004B should add exact STEP edge/wire semantics and selection so contours and planar regions can be reconstructed from BRep topology rather than sampled viewport edges.

004C can then perform conservative hole recognition from cylindrical faces plus their topology and axial limits.

## Gate

Technical PASS requires:

- `pnpm check`
- `pnpm build`
- `node scripts/check-004a-contracts.mjs`
- native OCCT test with a real STEP fixture

The native fixture must prove:

- `manufacturingFaces.length === faces`,
- stable sequential face IDs,
- every planar face has origin + normal,
- every cylindrical face has axis origin + axis direction + positive radius,
- display triangulation remains available but separate from manufacturing semantics.
