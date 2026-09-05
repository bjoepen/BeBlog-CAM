# Build 003C3 — Model Roughing Operation Integration

`Z-Level Schruppen` now has an operation-owned geometry source: `Face Target` or `STEP-Modell`.

The model strategy is rebuilt without viewport state from STEP/BRep triangulation, stock, placement/orientation, WCS and the operation parameters:

`STEP → slices → ModelSliceRegion → Stock−Model → PlanarRasterKernel → CanonicalToolpath`

Before release, every deeper cutting segment is sampled against all higher Stock−Model levels using the current tool diameter. A path hidden below model material is rejected as a top-accessibility FAIL.

003C3 deliberately requires `finishAllowanceMm = 0` for model mode. A real 3D allowance needs a true 3D offset and is not silently approximated.

The model mode now participates in Bearbeiten preview, operation summary, Prüfen, Gesamtjob preflight, Gesamtjob preview, single-operation Fräsen and Gesamtjob NC export. Missing `roughingMode` on older data is interpreted as `face-target`.
