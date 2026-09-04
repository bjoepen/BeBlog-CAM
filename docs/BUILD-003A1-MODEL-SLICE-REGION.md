# Build 003A1 — Model Slice Region Contract

## Goal

Convert raw horizontal triangle slices into an explicit, conservative model
material region per Z level.

This build does **not** generate machining paths.

## Input

`ZLevelSlice`

The existing slicer may produce:

- closed chains,
- open chains,
- multiple nested closed chains.

## Output

`ModelSliceRegion`

A valid region contains one or more material islands:

- `outer` — model material boundary,
- `holes` — direct voids inside that material island.

Nested islands inside holes are represented as separate material islands.

## Validity rules

The kernel rejects a slice when:

- any chain is open,
- a nominally closed loop has fewer than three unique points,
- a loop has effectively zero area,
- a loop self-intersects,
- two loops cross.

The kernel never repairs or artificially closes geometry.

## Nesting

Closed, non-intersecting loops are classified with an even/odd containment
contract:

- depth 0, 2, 4 ... → model material,
- depth 1, 3, 5 ... → void.

Orientation is not used as truth because tessellation/slicing direction is not
a reliable semantic signal.

## Architectural boundary

003A1 answers only:

> Where does model material exist on this Z plane?

It does not yet answer:

- where stock remains,
- where roughing is allowed,
- cutter-center offset,
- linking / retract strategy,
- G-code.

Those belong to 003B/003C.
