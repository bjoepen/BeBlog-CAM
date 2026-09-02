# BeBlog CAM

**CAM without the maze.**

BeBlog CAM is an open-source, maker-friendly CAM application for macOS. It turns DXF and STEP geometry into visible, verifiable toolpaths without forcing hobby makers through the usual CAM maze of object trees, permanent toolbars and deeply nested dialogs.

The guiding idea is simple:

> **Klarheit ist nicht weniger Information. Klarheit ist Information zur richtigen Zeit.**

BeBlog CAM keeps the workpiece at the center and follows one stable workflow:

**Bauteil → Rohling → Werkzeuge → Bearbeiten → Prüfen → Fräsen**

The interface stays calm while the CAM underneath is allowed to become technically capable.

## What already works

BeBlog CAM is no longer just an architecture experiment. The current alpha already contains a practical 2D/2.5D and emerging 3D workflow, including:

- DXF import for 2D geometry
- native STEP/BRep import through Open CASCADE Technology (OCCT)
- model orientation and work-coordinate handling
- stock definition from dimensions or part geometry
- material profiles and tool-library integration
- facing
- contour machining with **outside / inside / on-line** tool placement
- deliberately **opened contours**: individual segments of an otherwise closed contour can be excluded from machining
- pockets
- carve operations
- drilling
- helical bore milling
- STEP face selection
- Z-level roughing groundwork for 3D parts
- roughing allowance for a later finishing pass
- visual toolpath previews
- bounded **2.5D inspection** for checking real cutting depths without turning the 2D canvas into a full 3D viewer
- unified checks in **Prüfen**
- G-code generation for practical CNC workflows

Development is driven against real maker parts, including the CBG headstock reference workpiece, rather than synthetic demo geometry alone.

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

## No blind toolpaths

A CAM application should not ask the user to trust a calculation they cannot see.

BeBlog CAM is therefore moving toward a canonical toolpath pipeline in which the geometry shown in the viewport is the same machining geometry consumed by later checks and G-code generation.

Current previews use a visually distinct toolpath language and can expose multiple cutting depths through the 2.5D inspection view. This makes questions such as “Are there really three stepdowns?” or “Did that excluded contour segment come back?” answerable **before** G-code leaves the application.

The goal is straightforward:

**Operation → canonical toolpath → visual verification → Prüfen → G-code**

No surprise egg at the machine.

## Coordinate model

> **Part lives in stock. Stock lives on the machine.**

BeBlog CAM keeps the coordinate concerns separate:

- **Part** — design geometry and CAM features
- **Stock** — the real raw material, which may be larger than the part
- **WCS** — the measured work coordinate system on the CNC machine

The resulting mental and technical model is:

**Part → Stock → WCS → Machine**

This separation also leaves room for later probing workflows in which a slightly rotated real workpiece can be measured instead of requiring perfect manual alignment.

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

For the frontend gates:

```bash
pnpm check
pnpm build
```

For the native macOS development application:

```bash
pnpm native:dev
```

The native path is required when testing functionality that depends on the OCCT bridge, particularly STEP/BRep workflows.

## Scope

BeBlog CAM is focused on **3-axis maker CNC machining**.

The project deliberately does not try to become an industrial manufacturing suite. 4/5-axis machining, turning, production planning, cloud services and enterprise workflow management are outside the present product direction.

The aim is narrower and harder to fake: make common CNC work understandable, inspectable and pleasant without sacrificing the geometry and machining correctness underneath.

## Status

**Early alpha — under active development.**

The repository evolves in small, auditable increments against real machining workflows. Features are expected to pass both technical gates and visual/real-world checks before they are treated as established behaviour.

And yes, there is a CAM flea. Its job is to find problems before the router does. 🐜
