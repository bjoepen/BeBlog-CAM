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
│ OCCT/BRep    │ LinuxCNC      │
├──────────────┴───────────────┤
│ Project model / persistence  │
└──────────────────────────────┘
```

## 2. Core coordinate model

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

## 3. Probing model

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

## 4. Geometry layer

OCCT is the intended exact-geometry kernel. STEP should remain BRep as long as possible so the application can retain semantic surface information such as planes, cylinders, radii, edges and topology.

Tessellation is a derived representation for rendering, selected CAM algorithms and simulation; it is not the canonical part representation.

## 5. CAM operations

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

## 6. Simulation

Simulation must use the same operation/tool definitions as toolpath generation. Initial implementation may use a heightfield/voxel representation for 3-axis stock removal. Exact BRep reconstruction of machined stock is not required for 0.1.

Initial checks:

- tool cutting portion vs stock/part
- rapid move through remaining stock
- travel below configured safe height where inappropriate

Holder/fixture collision checking is a later extension but the data model must permit holder geometry and fixtures.

## 7. Postprocessing

Initial postprocessor:

- LinuxCNC

Postprocessors consume controller-neutral toolpaths and machine configuration. They must not recompute toolpaths.

An Estlcam-oriented output path can be investigated separately; BeBlog CAM must not assume Estlcam and LinuxCNC use identical controller semantics.

## 8. Reference part acceptance test

The initial end-to-end reference is a CBG headstock containing:

- planar headstock surface
- three Ø10 mm tuner holes
- outer profile
- neck/headstock transition requiring true 3D ballnose finishing

Build 0.1 is useful when this part can be programmed without another CAM application and the generated LinuxCNC program can be inspected/simulated safely.
