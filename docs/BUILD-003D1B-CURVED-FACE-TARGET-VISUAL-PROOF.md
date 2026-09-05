# Build 003D1b — Curved Face Target Visual Proof

## Goal

Prove visually that a selected STEP/BRep curved surface is reconstructed as a
single-valued height field:

`Z = f(X,Y)`

before any roughing or finishing toolpath is generated.

## Viewport proof

The STEP viewport gets a local diagnostic toggle:

`Gekrümmte Zielfläche`

When enabled, the selected face is sampled on a regular XY lattice.

Valid sample points are placed at their reconstructed surface Z and connected
into a lightweight 3D grid over the selected BRep surface.

## Diagnostic output

The caption reports:

- validity of `Z(x,y)`
- selected triangulation count
- min/max surface Z
- sample count

If the selected surface is not top-machinable as a single-valued height field,
the first kernel error is shown instead.

## Interpretation

PASS means:

- the grid visibly follows the cove curvature,
- grid and BRep stay registered under orbit/pan/zoom,
- no grid appears outside the selected face,
- min/max Z are plausible.

This is not a cutter path.

## Not included

- end-mill roughing
- ballnose finishing
- cutter compensation
- finish allowance
- NC export
