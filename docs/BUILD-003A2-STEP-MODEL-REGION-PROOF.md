# Build 003A2 — STEP Model Region Visual Proof

## Goal

Expose the 003A1 `ModelSliceRegion` contract directly in the STEP viewport
without changing CAM operation state or generating toolpaths.

## Behavior

The STEP geometry caption contains a local `Modellregionen` toggle.

When enabled:

1. the placed STEP display triangulation is sliced every 2.0 mm,
2. each `ZLevelSlice` is classified by `buildModelSliceRegions()`,
3. valid model-material loops are drawn over the BRep,
4. invalid/raw chains are drawn separately as diagnostics,
5. the caption reports:
   - valid / total slice count,
   - material island count,
   - hole count,
   - invalid slice count.

## Colors

- model region: blue line
- invalid slice geometry: dashed red line

Color is diagnostic only and has no CAM semantics.

## Architectural boundary

This is a read-only proof.

It does not:

- persist slice regions into an operation,
- alter Face Targets,
- generate stock-minus-model regions,
- apply cutter compensation,
- generate G-code.

## Gate

Use the CBG headstock reference STEP.

PASS requires:

- changing geometry is visible over multiple Z levels,
- bores/openings appear at plausible levels,
- curved neck/headstock transition changes shape with Z,
- no invented closing segments,
- invalid slices, if any, are visibly reported rather than silently repaired,
- orbit/pan/zoom changes only the camera.
