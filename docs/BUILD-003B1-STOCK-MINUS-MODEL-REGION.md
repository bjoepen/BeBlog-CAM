# Build 003B1 — Stock Minus Model Region Kernel

## Goal

Convert a valid `ModelSliceRegion` into the exact planar region that may be
removed from the stock on the same Z plane:

`RoughingRegion(Z) = Stock(Z) - ModelMaterial(Z)`

This build does **not** generate cutter paths.

## Input

- valid `ModelSliceRegion`
- rectangular XY stock bounds

## Output

`RoughingRegion`

A roughing region contains:

- the root stock island,
- holes where model material must remain,
- additional roughing islands inside model voids/openings.

Nested topology follows the even/odd depth contract from 003A.

## Topology example

```text
Stock                         rough
└─ Model depth 0              keep
   └─ Void depth 1            rough
      └─ Model depth 2        keep
         └─ Void depth 3      rough
```

## Conservative validity rules

003B1 rejects a slice when:

- the model slice is invalid,
- stock has no positive XY area,
- any model contour lies outside the rectangular stock.

No contour is clipped or repaired silently.

## Architectural boundary

003B1 answers only:

> Which XY regions are stock material but not model material at this Z level?

It does not yet answer:

- whether the region is top-accessible,
- cutter-center offset / tool radius,
- finish allowance,
- stepover,
- linking or retract strategy,
- G-code.

Those belong to 003B2 / 003C.
