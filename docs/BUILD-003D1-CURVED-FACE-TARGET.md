# Build 003D1 — Curved Face Target

## Goal

Extend the existing face-target concept from a constant horizontal target Z to
a selected STEP/BRep surface described as:

`Z = f(X,Y)`

This is the geometric prerequisite for machining the headstock cove / concave
transition.

## Scope

003D1 does **not** generate a toolpath.

It only proves that the selected STEP surface can safely act as a 3-axis
top-machining target.

## Contract

A curved face target must:

- belong to the current STEP/BRep face selection,
- have a valid display-triangle mapping,
- project to non-degenerate XY triangles,
- be single-valued in XY.

Single-valued means:

> for one XY cutter position, the selected target surface has exactly one Z.

Vertical folds, overhangs and ambiguous multi-Z selections are rejected.

## Surface query

`curvedFaceTargetZAt(target,x,y)`

returns the linearly interpolated target Z from the selected STEP
triangulation.

A `null` result means:

- XY is outside the selected surface, or
- the surface is ambiguous at that point.

## Why this matters

The existing Face Target roughing assumes:

`targetZ = constant`

The cove requires:

`targetZ = targetZ(x,y)`

003D2 can therefore remove material only above the selected curved surface
instead of treating the complete stock as the machining target.

## Architectural boundary

Not included yet:

- cutter radius / ballnose compensation,
- Z-level roughing,
- finishing raster,
- finish allowance,
- NC export.
