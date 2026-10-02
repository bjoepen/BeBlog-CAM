# BeBlog CAM

**CAM without the maze.**

[Deutsche Version](README.md)

BeBlog CAM is an open-source, maker-friendly CAM application for macOS. It turns DXF and STEP geometry into visible, verifiable toolpaths without forcing users through object trees, permanent toolbars and deeply nested dialogs.

**Current software version: 0.2.0-beta.3 — Beta / Production Qualification.**

> **Clarity is not less information. Clarity is information at the right time.**

The workflow deliberately stays stable:

**Part → Stock → Tools → Machine → Verify → Mill**

## What BeBlog CAM can do today

BeBlog CAM now covers a broad practical scope for 3-axis maker CNC work.

### 2D / 2.5D

- DXF import for planar geometry
- facing
- contour machining outside, inside and on-line
- closed and deliberately opened contours
- through-cutting with overcut and tabs
- radial/axial allowance and separate finishing passes
- pockets with raster, circular and contour-parallel strategies
- ramp and helical entry
- stock-aware/adaptive pocket roughing with bounded radial engagement
- rest machining with a smaller follow-up tool
- drilling and helical bore milling
- carve operations

### Contour-guided trochoidal milling

Trochoidal milling is a dedicated production strategy in BeBlog CAM, not merely a display mode for a conventional contour.

The current implementation supports:

- explicitly selected closed DXF contours
- inside and outside machining
- climb and conventional milling with physically resolved toolpath direction
- trochoid radius and forward step
- multiple depth levels
- manual target depth or stock-bottom through-cut semantics
- controlled overcut into a defined spoilboard
- radial and axial allowance
- sharp rectangular outside contours using a tangent rounded guide
- local forward-step adaptation on curved guide sections
- automatic forward-step limiting from the permitted material engagement
- protected helical entry
- constructive seed circle and material-aware bootstrap
- canonical preview, simulation, preflight and NC output from the same toolpath truth

A central difference from purely geometric path generation is material proof. The generator uses material that has already been demonstrably cleared as a prerequisite for subsequent bootstrap and trochoidal motions. The current released safety bound permits up to 140° of proven cutter material exposure. If a step cannot be generated within the proven limits, the strategy fails closed instead of releasing a merely plausible-looking path.

### STEP / BRep and 3D

- native STEP/BRep import through Open CASCADE Technology (OCCT)
- full model orientation before CAM calculation
- stock placement and work-coordinate handling
- STEP contour, pocket and drilling workflows
- Z-level roughing on selected target faces or the complete model
- BRep solid geometry as the authority for complete-model roughing
- island, reachability and material-connectivity handling
- 3D roughing on selected planar and curved BRep faces
- parallel X/Y roughing strategies with finishing allowance
- 3D finishing directly on selected BRep faces
- ball-nose tooling for the released 3D finishing path
- fail-closed release of 3D toolpaths

Exact STEP/BRep geometry remains the source of truth. Tessellation is used for display and interaction; it does not replace the CAD model.

## Tool library and cutting data

Tool management is no longer confined to individual operations. BeBlog CAM has a standalone tool library with JSON import/export and an expanded tool model. Tools can be assigned to operations and carry geometry relevant to safety and reachability checks.

Cutting data remains visible and understandable: feed, plunge feed, spindle speed, depth per pass, stepover and safe Z are not hidden behind an opaque automation layer.

## Verify is a production gate

A CAM application should not ask users to trust a calculation they cannot see.

BeBlog CAM therefore uses a canonical machine-motion pipeline. Preview, Simulation, Inspector, Preflight and NC are not intended to become separate interpretations of the same job.

> **Inspector Motion Truth = Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth.**

The production path is:

**Operation → Canonical Toolpath → Safe Motion → Preview / Simulation → Verify → NC**

Job Preflight can include toolpath validation, rest stock, tool/holder geometry, fixtures, machine-envelope limits and spindle-head collision checks. Unsafe or unproven states are not silently converted into NC.

**No surprise egg at the machine.**

## Coordinate model

> **Part lives in stock. Stock lives on the machine.**

BeBlog CAM separates:

- **Part** — design geometry and CAM targets
- **Stock** — the real raw material
- **WCS** — the work coordinate system measured on the CNC machine

The resulting model is:

**Part → Stock → WCS → Machine**

Machine probing and tool-length management remain controller responsibilities rather than hidden CAM behaviour.

## Product DNA

BeBlog CAM is designed from the perspective of a hobby maker, not an industrial CAM department.

- The left side stays simple; complexity grows contextually on the right.
- The workpiece remains the visual centre.
- Functions appear where they are needed in the machining workflow.
- Technical depth must not automatically become visual complexity.
- Expert parameters stay reachable without becoming default noise.
- Kernel terminology such as BRep or tessellation stays internal unless it genuinely helps diagnose a problem.
- **Verify** is a real workflow step before machine output.
- Usability is not postponed to a later polish phase.

> **BeBlog CAM presents a workflow, not a toolbox.**

The full product contract lives in [docs/PRODUCT-DNA.md](docs/PRODUCT-DNA.md).

## Technical foundation

- **Desktop:** Tauri v2
- **Frontend:** Svelte 5 + TypeScript
- **Native application/core:** Rust
- **Exact CAD geometry:** Open CASCADE Technology (OCCT)
- **Primary platform:** macOS
- **Current binary path:** Apple Silicon (arm64)
- **Package manager:** pnpm
- **NC/postprocessing:** Estlcam, GRBL and LinuxCNC dialects

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

The native path is required when testing STEP/BRep and 3D workflows.

### Native production build

```bash
pnpm native:build
```

This build enables `occt-native`, determines the required OCCT runtime dependency closure, bundles that runtime into the application and verifies that the resulting executable uses bundle-local Frameworks rather than a developer-machine OCCT installation.

A plain `pnpm tauri build` is therefore **not considered a valid production build** for the native STEP/BRep feature set.

## Release and installation

The current source and development version is **0.2.0-beta.3**.

Published binary artifacts should be verified separately against the corresponding release, filename and SHA-256 value. This README deliberately does not reuse the checksum of an older beta artifact for a newer software version.

The macOS beta currently does not use an Apple Developer ID signature/notarisation. Gatekeeper may therefore require manual approval on first launch via **System Settings → Privacy & Security → Open Anyway**. Globally disabling Gatekeeper is not required.

BeBlog CAM is beta software. Verify toolpaths and NC before real machining and retain normal machine-side safety procedures.

## Current development status

Build 008 established the production-readiness baseline, including the acceptance suite, project/failure hardening, STEP model orientation, Z-level performance and native macOS packaging.

Build 009 expanded the standalone tool library, import/export and tool model.

Build 010 established contour-guided trochoidal milling as a complete CAM strategy: from semantic guide geometry and material proof through protected entry, multi-depth machining and real machining limits to canonical preview and NC output.

**Status: Beta / Production Qualification — 0.2.0-beta.3.**

Features are considered established only when technical gates and real-world acceptance agree.

And yes, there is a CAM flea. Its job is to find problems before the router does. 🐜
