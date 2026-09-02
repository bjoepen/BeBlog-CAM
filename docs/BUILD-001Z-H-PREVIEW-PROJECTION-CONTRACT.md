# 001Z-H — Preview Projection Contract

## Problem

The old `GeometryView.scene2d()` mixed:

- DXF top view,
- Drill / Helix 2.5D camera,
- active-operation editing,
- Gesamtjob preflight.

A shared `drillViewMode` could therefore influence geometry, cut runs, entry
segments and machine motions in contexts where it did not belong.

## Contract

DXF preview now has three explicit modes:

- `edit-top`
- `drill-25d`
- `job-top`

All DXF geometry and all canonical CAM primitives use the same projector for
the selected mode.

### Top-view invariant

For `edit-top` and `job-top`:

`(x, y, z) -> (x, y)`

Z is never allowed to affect screen position.

### Drill 2.5D invariant

Only `drill-25d` may project Z into the screen plane.

## State rule

`job-top` is derived from the presence of Gesamtjob toolpaths.

Entering `Prüfen` does not mutate `drillViewMode` and does not repair camera
state. Previous editor camera state is simply irrelevant to the job projector.

## Scope

STEP/BRep 3D rendering is unchanged.
