# BeBlog CAM — Architecture

## 1. Boundaries

BeBlog CAM is split into independent layers. No CAM strategy may depend on the desktop UI and no postprocessor may own geometry logic.

```text
┌──────────────────────────────┐
│ Tauri / Svelte UI            │
├──────────────────────────────┤
│ Application services         │
├──────────────┬───────────────┤
│ CAM core     │ Machine setup │
├──────────────┼───────────────┤
│ Geometry     │ Postprocess   │
│ STEP / DXF   │ LinuxCNC      │
├──────────────┴───────────────┤
│ Project model / persistence  │
└──────────────────────────────┘
```

## 2. Dependency policy

BeBlog CAM must not depend directly on abandoned or effectively unmaintained CAM applications or libraries merely because they contain useful historical algorithms.

Rules for production dependencies:

- active upstream maintenance is required
- license compatibility must be reviewed before adoption
- geometry/toolpath engines must sit behind internal interfaces and remain replaceable
- external libraries must not leak their object model into project persistence
- reference implementations may be studied without becoming runtime dependencies

PyCAM is therefore **not** a BeBlog CAM dependency. It may be consulted as historical/reference material only.

OpenCAMLib is treated as a **candidate 3D engine**, not as a permanent architectural requirement. Its LGPL licensing and current upstream activity make evaluation reasonable, but BeBlog CAM's toolpath API must allow replacement or selective use.

## 3. Core coordinate model

### Part frame
The coordinate system in which the imported CAD part is oriented for machining.

### Stock frame
A raw-material volume containing the part. Stock dimensions and offsets are independent of part dimensions.

### Work coordinate system (WCS)
The transformation from CAM stock coordinates to the real stock on the machine.

The transform chain is:

```text
Part → Stock → WCS → Machine
```

This is a hard architectural rule.

## 4. Import and geometry model

STEP and DXF are first-class import formats from the beginning, but they represent different classes of geometry.

### STEP

STEP is the canonical 3D/BRep path. OCCT is the intended exact-geometry kernel and STEP should remain BRep as long as possible so BeBlog CAM retains semantic surface information such as:

- planes
- cylinders and radii
- analytic curves
- edges and wires
- faces and shells
- solids and topology

OCCT's STEP translator and shape-healing facilities are used at the import boundary.

### DXF

DXF is the canonical 2D/vector path for profiles, pockets, drilling layouts and other planar operations.

The preferred initial implementation is the Rust `dxf` crate (`dxf-rs`), provided its entity coverage passes BeBlog CAM import fixtures. It is MIT licensed and has a current 2026 release, avoiding a GPL dependency such as libdxfrw.

Initial DXF entities to support:

- LINE
- ARC
- CIRCLE
- LWPOLYLINE / POLYLINE
- SPLINE

DXF entities are normalized into BeBlog CAM's own planar geometry model. CAM strategies never operate directly on crate-specific DXF entities.

### Common geometry boundary

```text
STEP ──→ OCCT/BRep ──┐
                     ├─→ BeBlog geometry / feature layer → CAM operations
DXF ──→ DXF parser ──┘
```

3D BRep and planar vector geometry are deliberately not forced into one lowest-common-denominator representation.

Tessellation is a derived representation for rendering, selected CAM algorithms and simulation; it is not the canonical STEP part representation.

## 5. Probing model

The first probing workflow targets rectangular stock.

### XY stock alignment
- Probe point A on a selected stock edge.
- Probe point B on the same edge, with useful separation.
- Compute stock rotation in XY.
- Probe point C on the orthogonal stock edge.
- Resolve stock origin and XY transform.

### Z zero
A configurable touch plate is placed on stock top. Configuration includes:

- plate thickness
- coarse probe feed
- fine probe feed
- retract distance
- maximum search travel
- safety clearance
- input polarity / normally-open state

The intended cycle is coarse touch → retract → fine touch → retract → set Z0 corrected by plate thickness.

Probing results belong to machine/WCS setup, never to CAD geometry.

## 6. CAM operations

Initial operation families:

### 2.5D
- Facing
- Profile/contour
- Pocket
- Drill
- Helical bore

### 3D roughing
- Z-level roughing

### 3D finishing
- Parallel finish
- Waterline/contour finish

Tool geometry initially supports flat end mills and ballnose end mills.

Each operation produces a controller-neutral toolpath consisting of geometric moves plus machining intent. G-code is generated only in the postprocessing layer.

## 7. 3D toolpath engine boundary

The first research candidate is OpenCAMLib. It already provides drop-cutter and push-cutter/waterline algorithms and supports flat, ball, bull and other cutter shapes.

However, BeBlog CAM owns its operation definitions and neutral path representation. An adapter converts BeBlog CAM inputs to an engine and converts results back. This prevents OpenCAMLib, or any future replacement, from becoming the application's public data model.

FreeCAD CAM is useful as an architectural and behavioural reference because it already separates CAM jobs, tools, neutral paths and postprocessing, and currently uses OpenCAMLib for selected 3D surface operations. BeBlog CAM does not embed FreeCAD as a runtime dependency.

## 8. Simulation

Simulation must use the same operation/tool definitions as toolpath generation. Initial implementation may use a heightfield/voxel representation for 3-axis stock removal. Exact BRep reconstruction of machined stock is not required for 0.1.

Initial checks:

- tool cutting portion vs stock/part
- rapid move through remaining stock
- travel below configured safe height where inappropriate

Holder/fixture collision checking is a later extension but the data model must permit holder geometry and fixtures.

## 9. Postprocessing

Initial postprocessor:

- LinuxCNC

Postprocessors consume controller-neutral toolpaths and machine configuration. They must not recompute toolpaths.

An Estlcam-oriented output path can be investigated separately; BeBlog CAM must not assume Estlcam and LinuxCNC use identical controller semantics.

## 10. Reference part acceptance test

The initial end-to-end 3D reference is a CBG headstock containing:

- planar headstock surface
- three Ø10 mm tuner holes
- outer profile
- neck/headstock transition requiring true 3D ballnose finishing

A second 2.5D acceptance fixture must be supplied as DXF to verify profiles, circles/arcs and closed contours independently of STEP.

Build 0.1 is useful when both formats can be imported cleanly and the CBG headstock can be programmed without another CAM application, with generated LinuxCNC output inspected/simulated safely.
