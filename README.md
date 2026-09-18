# BeBlog CAM

**CAM without the maze.**

BeBlog CAM is an open-source, maker-friendly CAM application for macOS. It turns DXF and STEP geometry into visible, verifiable toolpaths without forcing hobby makers through the usual CAM maze of object trees, permanent toolbars and deeply nested dialogs.

**Current release: 0.2.0-beta.1 — Beta / Production Qualification.**

The guiding idea is simple:

> **Klarheit ist nicht weniger Information. Klarheit ist Information zur richtigen Zeit.**

BeBlog CAM keeps the workpiece at the center and follows one stable workflow:

**Bauteil → Rohling → Werkzeuge → Bearbeiten → Prüfen → Fräsen**

The interface stays calm while the CAM underneath is allowed to become technically capable.

## Download and macOS installation

The first public beta is currently provided for **Apple Silicon Macs (arm64)** as a DMG.

Release artifact:

`BeBlog CAM_0.2.0-beta.1_aarch64.dmg`

SHA-256:

```text
f0d7ab5b2163dd5bddc583b161460e3b6fe78a621f0ae2c1d848e41b9699ad2e
```

The application is currently **not signed with an Apple Developer ID and not notarized by Apple**. The binary carries only an ad-hoc signature. macOS Gatekeeper can therefore block the first launch after downloading the DMG.

To install the beta:

1. Open the DMG and copy **BeBlog CAM** to **Applications**.
2. Try to open BeBlog CAM normally once.
3. If macOS blocks it, open **System Settings → Privacy & Security** and use **Open Anyway** for BeBlog CAM.
4. Confirm the subsequent macOS prompt.

No Terminal command or global Gatekeeper deactivation is required.

This is a beta build. Verify toolpaths and NC before using them on a real machine, and retain the normal machine-side safety procedures.

## Current capability

BeBlog CAM has reached a broad practical 3-axis maker-CAM scope. The current system includes:

- DXF import for planar geometry
- native STEP/BRep import through Open CASCADE Technology (OCCT)
- full 3D model orientation before downstream STEP/CAM processing
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
- **Current binary release:** Apple Silicon (arm64)
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

This build path enables the `occt-native` feature, determines the required OCCT runtime dependency closure, bundles that runtime into the application and verifies that the resulting executable uses the bundle-local Frameworks path rather than a machine-local OCCT installation.

A plain `pnpm tauri build` is **not considered a valid production build**, because it may omit the native OCCT bridge and therefore lose STEP-derived 3D functionality.

The 0.2.0-beta.1 release qualification verified that the bundled application can run its native STEP workflow without depending on the development OCCT installation.

## Scope and known limitations

BeBlog CAM is focused on **3-axis maker CNC machining**.

The project deliberately does not try to become an industrial manufacturing suite. 4/5-axis machining, turning, production planning, cloud services and enterprise workflow management are outside the present product direction.

For 0.2.0-beta.1:

- the downloadable macOS build is Apple Silicon/arm64
- the application is not Apple Developer-ID signed or notarized
- first launch can therefore require manual Gatekeeper approval
- external Estlcam/machine qualification remains a deliberately manual step
- Surface Carve was explored experimentally and rejected after real-world acceptance; its research code is not part of the production feature set

The aim is narrower and harder to fake: make common CNC work understandable, inspectable and pleasant without sacrificing the geometry and machining correctness underneath.

## Road to production readiness

Build 008 established the production-readiness baseline and moved BeBlog CAM out of the alpha phase:

- **008A — Production Acceptance Suite:** reproducible reference jobs and NC regression gates
- **008B — Project & Failure Hardening:** deterministic persistence and fail-closed recovery paths
- **008C1/008C2 — Estlcam Qualification Baseline:** qualified syntax contract and frozen reference NC
- **008C3/008C4 — External Qualification:** deliberately deferred manual Estlcam and machine validation
- **008D — STEP Model Orientation:** one shared oriented-model truth for downstream STEP consumers
- **008E — Z-Level Roughing Performance:** production profiling, demand-gated calculation and spatial indexing without weakening geometric safety checks
- **008F — Native macOS Packaging:** self-contained OCCT runtime bundle and portable native STEP application
- **008G — Release Qualification:** release artifact, checksum, Gatekeeper/signing assessment and public-beta preparation

See [Build 008 — Production Readiness Roadmap](docs/ROADMAP-008-PRODUCTION-READINESS.md).

## Status

**Beta / Production Qualification — 0.2.0-beta.1.**

Build 008 established the software production-readiness baseline. Builds 008D through 008G then qualified model orientation, real-world Z-Level performance, native macOS packaging and the first public-beta release path without reopening the validated CAM contracts.

Features are established only after technical gates and real-world acceptance agree.

And yes, there is a CAM flea. Its job is to find problems before the router does. 🐜
