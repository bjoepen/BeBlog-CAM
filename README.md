# BeBlog CAM

**Focused 3-axis CAM for makers. macOS first.**

BeBlog CAM is an experimental open-source CAM application focused on small CNC routers and practical maker workflows. The initial target is intentionally narrow: import a STEP part, define stock and tools, create 2.5D/3D toolpaths, simulate the result, and export G-code for LinuxCNC and Estlcam-oriented workflows.

## Product principle

> Part lives in stock. Stock lives on the machine.

The data model keeps three coordinate concerns separate from day one:

- **Part** — design geometry and CAM features.
- **Stock** — the real raw material, which may be larger than the part.
- **WCS** — the measured work coordinate system on the CNC machine.

This allows future stock probing to measure a slightly rotated workpiece without forcing the user to align it perfectly by hand.

## 0.1 scope

The first useful milestone is a complete 3-axis workflow for the CBG headstock reference part:

1. STEP/BRep import
2. model orientation
3. rectangular stock definition
4. tool library
5. facing
6. contouring
7. pockets
8. drilling / helical bore milling
9. Z-level roughing
10. parallel 3D finishing with ballnose tools
11. stock simulation
12. basic collision checks
13. LinuxCNC postprocessor
14. configurable probing model for stock XY alignment and Z-zero

Explicitly out of scope for 0.1: 4/5-axis machining, turning, ATC management, production planning and cloud services.

## Technical direction

- **Desktop shell:** Tauri v2
- **Frontend:** Svelte + TypeScript
- **Application/core:** Rust
- **Exact CAD geometry:** Open CASCADE Technology (OCCT)
- **3D toolpath research baseline:** OpenCAMLib
- **Primary platform:** macOS
- **Initial controller target:** LinuxCNC

The repository is intentionally starting architecture-first. Geometry and CAM engines must remain independent from UI and postprocessors so that strategies can evolve without rewriting the application shell.

## Reference workflow

```text
STEP
  ↓
Part / BRep
  ↓
Orientation
  ↓
Stock
  ↓
Operations
  ├─ 2.5D
  └─ 3D
  ↓
Toolpaths
  ↓
Stock simulation / checks
  ↓
Postprocessor
  ↓
LinuxCNC G-code
```

## Status

**Build 001 — bootstrap in progress.**

The CAM flea is not considered a safety system. 🦟
