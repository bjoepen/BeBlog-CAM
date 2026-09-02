# 001Z-I — Drill Canonical Runs

## Architectural correction

Drill / Helix canonical data previously contained only full XYZ `motions` and
an empty `runs` array.

That forced a 2D Gesamtjob preview to visualize machine motion, mixing
retracts, plunges and simultaneous XYZ helix descent with the planar cut view.

## New contract

Drill canonical toolpaths now expose both:

- `motions`: complete XYZ machine motion, authoritative for NC output,
  machine-motion validation and Drill 2.5D view.
- `runs`: planar XY cutter-center cutting geometry, authoritative for DXF top
  preview.

Rapid moves and pure Z motion are excluded from planar runs.

Helical G2/G3 motion keeps its native XY arc as a canonical arc segment while
the simultaneous Z descent remains exclusively in `motions`.

## Preview rule

`job-top` renders canonical `runs` only.

It never renders `motions` or entry motion as cut geometry.

`drill-25d` may continue to render full XYZ machine motion.
