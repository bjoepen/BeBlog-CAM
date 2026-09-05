# Build 003B2 — Roughing Region Visual Proof

## Goal

Visualize the 003B1 `Stock - Model` result directly in the STEP viewport.

This remains a read-only geometry proof.

## Behavior

The STEP caption gets a local `Stock - Model` toggle.

When enabled:

1. the placed STEP model is sliced every 2.0 mm,
2. 003A converts each slice to `ModelSliceRegion`,
3. 003B1 converts each valid model region into `RoughingRegion`,
4. roughing boundaries are drawn over the STEP model,
5. invalid roughing slices are shown separately,
6. the caption reports valid/total slices, roughing islands, keep-holes and invalid slices.

## Diagnostic layers

- `Modellregionen` — blue
- `Stock - Model` — amber
- invalid geometry — red dashed

Both proof layers are independent toggles.

## Architectural boundary

003B2 does not offset by tool radius, apply finish allowance, decide top accessibility, rasterize, link cuts or generate NC.

## Gate

Use the CBG headstock reference.

PASS requires:

- outer stock area appears removable where no model exists,
- model body remains excluded,
- model openings become removable islands where topologically valid,
- roughing region changes plausibly with Z,
- no geometry appears outside stock,
- invalid slices are explicit,
- orbit/pan/zoom changes only the camera.
