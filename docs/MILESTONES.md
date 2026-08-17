# BeBlog CAM — Milestones

## 2026-08-17 — First native STEP/BRep model on macOS

BeBlog CAM successfully opened and displayed a real STEP model (`CBG Headstock v1.step`) on macOS through the native OCCT 8 integration.

Verified path:

`STEP → OCCT 8 native C++ bridge → exact BRep → BeBlog import layer → display tessellation → viewport`

Observed real-world result:

- 16 faces
- 72 edges
- 2 solids
- analytic cylindrical surfaces detected
- repeated 5.000 mm cylinder radii detected
- 504 display triangles generated for visualization
- exact BRep retained as source of truth; display mesh kept separate

This milestone proves that BeBlog CAM can ingest real CAD geometry natively on macOS without converting STEP to STL as the machining source.

### Known limitation at this milestone

The 3D viewport is still a static projection. Free orbit, pan and zoom are required before the viewport can be considered usable for CAM work.
