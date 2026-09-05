# Build 003D2 — Curved Face Roughing Visual Proof

## Goal

Generate a conservative flat-endmill Z-level roughing preview for one selected
curved STEP/BRep face such as the headstock cove.

This build does not generate NC.

## Machining boundary

Only the selected curved face is considered.

The complete stock outside that selected face is untouched.

## Flat-endmill safety

A cutter-center point is not sufficient for a curved surface.

For every candidate XY point, 003D2 samples the complete bottom disk of the
flat endmill.

A point is released only when:

1. every sampled point remains inside the selected face footprint, and
2. the current Z level stays at or above `Z(x,y) + finish allowance` for the
   complete cutter disk.

This conservatively protects the curved target from gouging.

## Z-level strategy

Levels descend from stock top using the operation's `stepDownMm`.

Each level gets an XY raster using the operation's stepover.

No material outside the selected surface footprint is considered removable.

## Visual proof

Viewport toggle:

`Hohlkehle Schruppen`

The proof reports:

- Z-level count,
- roughing chain count,
- tool diameter,
- stepdown.

## Gate

PASS requires:

- paths occur only over the selected cove,
- paths become narrower / change with surface depth,
- no path crosses outside the selected face,
- the cutter does not visually penetrate the target surface,
- changing tool diameter changes the safe machining region,
- orbit/pan/zoom preserves registration.
