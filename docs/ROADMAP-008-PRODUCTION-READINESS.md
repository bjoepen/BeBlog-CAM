# Build 008 — Production Readiness Roadmap

## Status

Build 008 marks the transition from feature expansion to production hardening.

BeBlog CAM already covers the intended 3-axis maker workflow. New machining strategies are not the priority for this phase. The goal is to prove that the existing workflow is reproducible, fail-safe and suitable for real machine use.

## Product target

**CAM without the maze.**

The binding workflow remains:

**Bauteil → Rohling → Werkzeuge → Bearbeiten → Prüfen → Fräsen**

`Prüfen` is a first-class production gate. It is not an informational afterthought: the job that reaches `Fräsen` must be derived from the same validated machine-motion truth that was inspected in Preview, Simulation and Preflight.

Binding invariant:

> **Inspector Motion Truth = Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth.**

004T Safe Motion and the existing canonical-toolpath contracts remain protected boundaries throughout Build 008.

## Scope freeze

Build 008 does not seek broad new CAM functionality. The established production scope is:

- DXF import
- native STEP/BRep import through OCCT
- stock, placement, orientation and WCS
- material and tool integration
- facing
- contour machining
- pockets
- carve
- drilling
- helical bore milling
- STEP contour/pocket/drill workflows
- Z-Level roughing
- 3D surface finishing
- Preview, Simulation and Inspector
- Prüfen / Job Preflight
- G-code generation
- Estlcam production output

Surface Carve remains rejected as a product feature after the 007E real-world failure. The isolated 007A/007B research helpers do not expand the production scope.

## 008A — Production Acceptance Suite

Create reproducible reference jobs and automated regression checks for the established machining paths.

Initial acceptance matrix:

1. DXF contour
2. DXF pocket
3. DXF multi-target
4. DXF drilling
5. helical bore milling
6. STEP contour
7. STEP pocket
8. STEP drilling
9. Z-Level roughing
10. 3D surface finishing
11. multi-operation job with tool change
12. through-cut / allowance case

Each reference job must prove the same path through:

**Operation → Canonical Toolpath → 004T → Preflight → NC → Estlcam Postprocessor**

The suite should assert stable machine-motion properties rather than accidentally blessing formatting noise.

## 008B — Project & Failure Hardening

Exercise failure and recovery paths without widening the project model unnecessarily.

Required cases include:

- valid project save/load round-trip
- malformed project file
- unsupported/newer project version
- missing source file
- moved source file
- source geometry changed after project creation
- invalid or missing operation/tool references
- interrupted or failed save where practical
- project reload followed by deterministic Preflight and NC generation

The guiding rule is **fail closed, explain clearly, never silently machine a different job**.

## 008C — Estlcam Production Qualification

The first production controller profile is deliberately narrow:

**Estlcam 11 / 3-axis milling / millimetres / manual tool change**

Estlcam 11 build 11245 is the current real-world reference.

The existing postprocessor remains syntax-only. It must never reconstruct or reinterpret machining geometry. Reference jobs should be checked against the actual controller workflow and, where appropriate, real machine output.

GRBL and LinuxCNC remain supported/reference dialects but are not required to block the first production-ready release unless separately qualified.

## 008D — Release Candidate

Define a repeatable clean release path:

1. clean checkout
2. locked dependencies
3. frontend/static contracts
4. Rust/native checks
5. native OCCT build
6. Tauri application bundle
7. DMG packaging
8. clean installation
9. reference project load
10. Preflight PASS
11. Estlcam NC export
12. real-world acceptance

### Native DMG rule

A production DMG **must be built with the native OCCT feature**.

The authoritative build entry point is:

```bash
pnpm native:build
```

which invokes the macOS native build script and ultimately:

```bash
pnpm tauri build --features occt-native
```

A plain `pnpm tauri build` is **not a valid production DMG build**, because it can omit native STEP/BRep capability and therefore break STEP-derived 3D jobs.

Build 008 should make this distinction difficult to miss and, where practical, fail closed for release packaging that does not include the native feature.

## Production-readiness definition

BeBlog CAM reaches the Build-008 goal when:

- established operations have reproducible acceptance jobs
- Preview / Simulation / Preflight / NC continue to share the same motion truth
- 004T remains mandatory
- project failures are explicit and safe
- Estlcam output is qualified against the reference workflow
- a clean native macOS DMG can be built and installed reproducibly
- STEP/BRep and 3D jobs are present in that installed DMG
- no rejected research feature is accidentally exposed as production functionality

At that point the next decision is release qualification, not another feature sprint.
