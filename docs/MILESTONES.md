# BeBlog CAM — Milestones

## 2026-08-19 — 001G Final: native DXF CAM pipeline with `.nc` export

BeBlog CAM completed the first fully regression-checked native DXF machining pipeline.

Verified path:

`DXF CAD semantics → analytical tool-radius compensation → mathematical preflight → native G1/G2/G3 → depth passes → WCS → .nc export → external validation`

Verified real-world reference cases include:

- native DXF circles emitted as two controller-friendly 180° G2/G3 arcs per pass;
- mixed LINE/ARC contours emitted as native G1 plus G2/G3 rather than polygonized curve approximations;
- the real Mini-OX side-plate outer contour as the complex reference geometry;
- outside and inside compensation from the same CAD source contour;
- climb and conventional direction reversal with geometrically identical tool-center paths and consistent G2/G3 reversal;
- mathematical preflight before machine output;
- safe fallback to the previously verified G1 reference path when native semantic offset geometry cannot be proven safe;
- direct `.nc` export of exactly the G-code shown in the application.

A key validation rule was established during external viewer testing:

**External simulators and viewers are validation aids, not the geometric source of truth.**

The CAD source contour and BeBlog CAM's mathematically verified toolpath remain authoritative.

001G proves that BeBlog CAM is no longer only a CAD viewer or CAM UI prototype: it can preserve real DXF geometry semantics through compensation and validation into a reusable machine-program file.

Detailed record: `docs/BUILD-001G.md`

---

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
