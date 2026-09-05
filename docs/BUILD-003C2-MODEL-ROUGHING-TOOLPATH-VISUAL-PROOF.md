# Build 003C2 — Model Roughing Toolpath Visual Proof

## Goal

Visualize the first true model-based canonical Z-level cutting paths over the
STEP model.

This remains a read-only proof. No operation model or NC export is changed.

## Parameter source

The active `Z-Level Schruppen` operation supplies tool diameter, stepover and
the active WCS origin. The proof does not mutate that operation.

## Pipeline

STEP
→ ModelSliceRegion
→ Stock − Model RoughingRegion
→ shared PlanarRasterKernel
→ CanonicalToolpath
→ STEP preview

## Diagnostic layers

- model regions — blue
- Stock − Model — amber
- model roughing canonical toolpath — cyan
- invalid region geometry — red dashed

## Coordinate contract

The C2 canonical toolpath is generated in active WCS coordinates and converted
back into world/stock coordinates only for STEP rendering.

## Gate

Using the CBG headstock:

- activate a `Z-Level Schruppen` operation,
- enable `Modell-Schruppbahn`,
- verify paths exist only in Stock−Model material,
- verify model/keep regions are never crossed,
- verify multiple Z levels follow the changing STEP shape,
- verify small inaccessible islands may be skipped with warnings,
- verify orbit/pan/zoom changes only the camera.

No NC export is part of 003C2.
