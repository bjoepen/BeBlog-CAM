# Build 003C1 — Model Roughing Canonical Toolpath Kernel

## Goal

Generate the first true model-based Z-level canonical cutting paths from the
validated 003B `Stock - Model` regions.

## Shared raster contract

The cutter-center raster logic from 001Z Face-Target roughing is extracted into
`planarRasterKernel.ts`.

Both:

- Face-Target Z-Level roughing
- model-based Stock−Model roughing

now use the same rules for:

- even/odd region membership,
- tool-radius boundary clearance,
- stepover raster generation,
- serpentine ordering,
- safe connector linking.

There is no second raster implementation.

## Model roughing input

`buildModelRoughingCanonicalToolpath()` receives:

- valid `RoughingRegion[]`,
- tool diameter,
- stepover,
- WCS/machine origin.

Regions are processed from highest Z to lowest Z.

Each topological roughing island is rasterized independently.

## Output

A controller-neutral `CanonicalToolpath`:

- operation kind: `z-level-roughing`
- strategy: `model-raster`
- XY in WCS coordinates
- Z in WCS coordinates
- safe disconnected cut chains with `retractAfter=true`

## Conservative behavior

The build fails when:

- any input roughing slice is invalid,
- tool diameter / stepover are invalid,
- no cutter-center-safe path can be produced.

Small individual islands that cannot fit the current cutter are skipped with a
warning rather than crossed unsafely.

## Not yet in 003C1

- operation/UI integration,
- preview in `GeometryView`,
- finish allowance,
- top-accessibility / occlusion pruning,
- G-code export.

Those are subsequent 003C gates.
