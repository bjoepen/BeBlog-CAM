# Build 003D3a — Ballnose Surface Contact Kernel

## Goal

Compute the correct ball-center position for tangential contact with a selected
curved STEP/BRep surface.

For the height field `Z = f(X,Y)` the local upward normal is estimated as:

`n = normalize(-dZ/dX, -dZ/dY, 1)`

For ballnose radius `R`:

`center = surface + n * R`

This includes the required X/Y shift on sloped surfaces; simply adding `R` to Z
would be geometrically wrong.

The contact is rejected when the target is invalid, XY lies outside the face,
the local normal is unstable, or the surface is not top-machinable.

003D3a computes one compensated contact point only. Raster finishing and NC
follow in later gates.
