# BeBlog CAM

**CAM without the maze.**

BeBlog CAM is an open-source, maker-friendly CAM application for macOS. It turns DXF and STEP geometry into visible, verifiable toolpaths without forcing hobby makers through the usual CAM maze of object trees, permanent toolbars and deeply nested dialogs.

The guiding idea is simple:

> **Klarheit ist nicht weniger Information. Klarheit ist Information zur richtigen Zeit.**

BeBlog CAM keeps the workpiece at the center and follows one stable workflow:

**Bauteil → Rohling → Werkzeuge → Bearbeiten → Prüfen → Fräsen**

The interface stays calm while the CAM underneath is allowed to become technically capable.

## Current capability

BeBlog CAM has reached a broad practical 3-axis maker-CAM scope. The current system includes:

- DXF import for planar geometry
- native STEP/BRep import through Open CASCADE Technology (OCCT)
- model orientation, stock placement and work-coordinate handling
- stock definition from dimensions or part geometry
- material profiles and tool-library integration
- facing
- contour machining with **outside / inside / on-line** tool placement
- deliberately **opened contours** and spatial tabs
- pockets, including multi-target and through-cut allowance workflows
- carve operations
- drilling and helical bore milling
- STEP contour, pocket and drilling workflows
- Z-Level roughing for STEP/BRep models
- roughing/finishing allowances and stock-aware machining support
- 3D surface finishing
- visual Job Preview
- machine-motion Simulation and Inspector
- unified Job Preflight in **Prüfen**
- G-code generation
- explicit Estlcam, GRBL and LinuxCNC postprocessor dialects

Development is driven against real maker parts and real generated NC rather than synthetic demo geometry alone.

## Product DNA

BeBlog CAM is designed from the perspective of a hobby maker, not an industrial CAM department.

A few rules are deliberately binding:

- **The left side stays simple. Complexity grows contextually on the right.**
- The workpiece remains the visual center.
- Functions appear where they are needed in the machining workflow.
- Technical depth must not automatically become visual complexity.
- Expert parameters stay reachable without becoming default noise.
- Kernel terminology such as BRep or tessellation stays internal unless it genuinely helps diagnose a problem.
- `Prüfen` is a real workflow step before machine output, not an afterthought.
- Every build should already feel like BeBlog CAM; usability is not postponed to a later polish phase.

Or, more compactly:

> **BeBlog CAM zeigt einen Arbeitsablauf, keine Werkzeugkiste.**

The full product contract lives in [docs/PRODUCT-DNA.md](docs/PRODUCT-DNA.md).

## Prüfen is a production gate

A CAM application should not ask the user to trust a calculation they cannot see.

BeBlog CAM therefore uses a canonical machine-motion pipeline. Preview, Simulation, Inspector, Preflight and NC are not intended to become separate interpretations of the job.

The binding direction is:

> **Inspector Motion Truth = Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth.**

`Prüfen` validates the actual job before machine output. Depending on the configured job it can include canonical-toolpath validation, 004T safe-motion materialization, rest-stock/tool-assembly checks, fixture collision checks, machine-envelope checks and spindle-head collision checks.

The production path is:

**Operation → Canonical Toolpath → 004T Safe Motion → Preview / Simulation → Prüfen → NC**

No surprise egg at the machine.

## Coordinate model

> **Part lives in stock. Stock lives on the machine.**

BeBlog CAM keeps the coordinate concerns separate:

- **Part** — design geometry and CAM features
- **Stock** — the real raw material, which may be larger than the part
- **WCS** — the measured work coordinate system on the CNC machine

The resulting mental and technical model is:

**Part → Stock → WCS → Machine**

Machine-side probing and tool-length handling remain controller responsibilities rather than hidden CAM behavior.

## Technical foundation

- **Desktop:** Tauri v2
- **Frontend:** Svelte 5 + TypeScript
- **Native application/core:** Rust
- **Exact CAD geometry:** Open CASCADE Technology (OCCT)
- **Primary platform:** macOS
- **Package manager:** pnpm

Exact STEP/BRep geometry remains the source of truth. Tessellation exists for display and interaction; it does not replace the CAD model.

Geometry, CAM strategies, visualisation, validation and postprocessing are kept separate enough that one layer can evolve without silently redefining another.

## Development

Frontend/static gates:

```bash
pnpm check
pnpm build
```

Native macOS development application:

```bash
pnpm native:dev
```

The native path is mandatory when testing STEP/BRep and 3D workflows.

### Native production build

A production macOS application/DMG must be built through:

```bash
pnpm native:build
```

This build path enables the `occt-native` feature and bundles the native STEP/BRep implementation. A plain `pnpm tauri build` is **not considered a valid production build**, because it may omit the native OCCT bridge and therefore lose STEP-derived 3D functionality.

## Scope

BeBlog CAM is focused on **3-axis maker CNC machining**.

The project deliberately does not try to become an industrial manufacturing suite. 4/5-axis machining, turning, production planning, cloud services and enterprise workflow management are outside the present product direction.

Surface Carve was explored experimentally and rejected after real-world acceptance. Its research code does not form part of the production feature set.

The aim is narrower and harder to fake: make common CNC work understandable, inspectable and pleasant without sacrificing the geometry and machining correctness underneath.

## Road to production readiness

Feature expansion is no longer the primary development goal. Build 008 focuses on proving and hardening the existing system:

- **008A — Production Acceptance Suite:** reproducible reference jobs and NC regression gates
- **008B — Project & Failure Hardening:** deterministic persistence and fail-closed recovery paths
- **008C — Estlcam Production Qualification:** qualify the real Estlcam 11 / 3-axis workflow
- **008D — Release Candidate:** reproducible native macOS build, DMG, installation and end-to-end acceptance

See [Build 008 — Production Readiness Roadmap](docs/ROADMAP-008-PRODUCTION-READINESS.md).

## Status

**Production-hardening alpha.**

The intended maker-CAM feature scope is substantially present. Current development prioritizes reproducible acceptance, failure safety, controller qualification and release packaging over additional machining strategies.

Features are established only after technical gates and real-world acceptance agree.

And yes, there is a CAM flea. Its job is to find problems before the router does. 🐜
