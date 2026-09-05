# Build 003D3a2 — Ballnose Contact Visual Proof

## Goal

Visualize the 003D3a ballnose compensation contract directly on the selected
curved STEP surface.

## Proof elements

Several sample points are distributed over the selected face.

For each valid sample:

- surface contact point is shown,
- local upward surface normal is shown,
- compensated ball-center point is shown,
- surface-to-center offset is shown.

## Interpretation

On sloped parts of the cove, the ball center must move in X/Y as well as Z.

If the center merely sits vertically above every surface point, the
compensation is wrong.

## Gate

PASS requires:

- contact points lie on the selected curved face,
- normals change direction with surface slope,
- center points move along those normals,
- steeper areas show visible lateral X/Y compensation,
- all proof geometry remains registered during orbit/pan/zoom.

No finishing toolpath or NC is generated.
