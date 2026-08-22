# BeBlog CAM 001C — Native STEP on macOS

## Purpose

001C makes exact STEP/BRep development a normal local workflow instead of a specialist build procedure.

## One-command development path

```bash
pnpm native:dev
```

On the first run this will:

1. build the pinned OCCT 8.0.1 source into `.cache/occt/install`,
2. export the local OCCT prefix and dynamic-library path,
3. launch Tauri with Cargo feature `occt-native`.

Subsequent runs reuse the installed OCCT build.

## Native smoke test

```bash
pnpm native:test
```

This loads a real STEP fixture through the native C++ bridge and asserts that:

- exact BRep was loaded,
- faces and edges exist,
- display tessellation exists,
- the display vertex stream matches the reported triangle count.

## Real-world gate

Open `CBG Headstock v1.step` in BeBlog CAM and confirm:

- status is `Bereit`,
- backend reports the native OCCT bridge,
- faces / edges / solids are reported,
- analytic cylinders and radii are visible in diagnostics where present,
- a real 3D display mesh appears in the central viewport,
- no STL intermediate is involved.

## Invariant

The tessellation is a rendering derivative only. The imported OCCT BRep remains the source of truth for later CAM feature recognition and toolpath generation.
