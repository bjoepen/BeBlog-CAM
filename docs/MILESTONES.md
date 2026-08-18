# BeBlog CAM — Milestones

## 2026-08-18 — First verified DXF-to-G-code CAM pipeline

BeBlog CAM successfully completed, externally visualized and dynamically simulated its first verified CAM chain for a real DXF contour.

Verified path:

`DXF → CAD contour as source of truth → tool-radius compensation → mathematical toolpath validation → depth passes → WCS transformation → G-code → external NC viewer → dynamic simulation`

Key result:

- CAD contour coordinates remain the authoritative finished-part geometry.
- The generated tool-center path is mathematically checked against that contour before G-code generation.
- Test case: Ø 4.000 mm cutter, outside path, expected radius offset 2.000 mm.
- Three depth passes were generated at Z -1.000 / -2.000 / -3.000 mm.
- Safe Z was +5.000 mm; feed 600 mm/min; plunge 200 mm/min; spindle 12,000 1/min.
- The resulting G-code was rendered plausibly in an external NC viewer with coincident XY contours across all three depth passes.
- The complete program was then played in the simulator and followed the expected contour and pass sequence correctly.
- The visible segmented motion on curves confirms the current `G1` reference implementation and motivates native `G2/G3` output in the following build.
- `05 · Prüfen` is established as the mandatory preflight gate before `06 · Fräsen`.

This milestone closes BeBlog CAM's first fundamental path from real CAD geometry to a numerically validated and dynamically simulated machine trajectory.

Detailed record: `docs/BUILD-001F.md`

### Known limitations at this milestone

G-code is still preview-only, curves are currently emitted as segmented `G1` moves rather than native `G2/G3` arcs, bottom-side WCS output remains intentionally blocked pending a validated material-thickness transformation, and multi-operation/tool-change workflows are not yet part of this gate.

---

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
