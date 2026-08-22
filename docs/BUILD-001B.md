# BeBlog CAM 001B — Geometry Foundation

## Goal

001B turns the import boundary from 001A into BeBlog-owned geometry. The CAM core must not depend on parser-specific DXF entities or on tessellated STEP data.

## Implemented in this increment

- internal planar geometry primitives (`Line`, `Circle`, `Arc`, `Polyline`)
- geometry bounds independent of DXF
- DXF normalization from `dxf-rs` into BeBlog Geometry
- explicit BRep backend contract for native OCCT 8 integration
- STEP remains BRep-first; STL conversion is explicitly prohibited as the feature-recognition path

## Native OCCT integration gate

The next 001B increment is complete only when a macOS build can:

1. load STEP/STP through OCCT 8,
2. retain exact BRep topology,
3. enumerate solids, faces, edges and vertices,
4. classify at least planes, cylinders and other/unknown surfaces,
5. expose analytic cylinder radius where available,
6. generate display tessellation separately from the exact BRep,
7. pass the CBG headstock reference STEP without an STL intermediate.

## DXF acceptance gate

A DXF reference plate must normalize common 2D entities into BeBlog Geometry. Unsupported entities are reported rather than silently reinterpreted. The original DXF parser types must not escape the import layer.

## Architecture invariant

> Exact geometry is source truth. Display meshes are views, not the CAM model.
