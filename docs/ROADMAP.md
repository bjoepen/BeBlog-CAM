# BeBlog CAM — Roadmap

## Build 001 — Foundation

Goal: establish the project and prove the geometry/toolpath architecture before feature growth.

- [ ] Tauri v2 + Svelte desktop shell on macOS
- [ ] Rust workspace and CAM-core crate
- [ ] Project model: Part → Stock → WCS
- [ ] Machine/tool/probe configuration models
- [ ] 3D viewport
- [ ] STEP import spike with OCCT
- [ ] show imported BRep as tessellated model
- [ ] model orientation controls
- [ ] rectangular stock definition and visualization
- [ ] save/load project

### Gate 001
A STEP file can be opened on macOS, oriented, placed inside a larger stock and saved as a BeBlog CAM project.

## Build 002 — First chips

- [ ] flat and ballnose tool definitions
- [ ] facing
- [ ] contour
- [ ] drilling
- [ ] helical bore milling
- [ ] controller-neutral toolpath model
- [ ] LinuxCNC postprocessor v1
- [ ] toolpath preview

### Gate 002
A simple 2.5D plate can be programmed entirely in BeBlog CAM and exported as inspectable LinuxCNC G-code.

## Build 003 — 3D

- [ ] Z-level roughing
- [ ] parallel 3D finishing
- [ ] machining boundaries / selected faces
- [ ] ballnose geometry compensation
- [ ] basic stock-removal simulation

### Gate 003 — CBG reference
The CBG headstock can be programmed including its neck/headstock transition with a ballnose finishing operation.

## Build 004 — Stock probing

- [ ] configurable touch plate
- [ ] two-point stock-edge angle measurement
- [ ] orthogonal-edge origin measurement
- [ ] Z-zero touch cycle
- [ ] LinuxCNC probing program generation
- [ ] measured Stock → WCS transformation
- [ ] sanity limits and explicit operator confirmation before coordinate changes

### Gate 004
A rectangular stock may be mounted slightly rotated; probing establishes XY position, XY rotation and stock-top Z zero without manual precision alignment.

## Build 005 — Workshop confidence

- [ ] waterline/contour finish
- [ ] improved stock simulation
- [ ] holder model
- [ ] fixture model
- [ ] collision checks
- [ ] operation warnings
- [ ] postprocessor regression fixtures

## Not before 1.0

- 4-axis machining
- 5-axis machining
- turning / mill-turn
- automatic tool changer management
- production scheduling
- cloud accounts
- marketplace/plugin ecosystem

Scope growth requires a real reference job that cannot be handled cleanly by the existing operation set.
