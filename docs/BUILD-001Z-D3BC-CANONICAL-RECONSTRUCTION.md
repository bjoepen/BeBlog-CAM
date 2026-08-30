# 001Z-D3b/c — Viewport-independent Face-Target reconstruction

The canonical Z-Level roughing path can now be rebuilt from:

`STEP BRep + stock/setup + ZLevelRoughingOperation.faceIds`

The viewport is no longer required as a source of truth for preflight.

## Consequences

- single-operation Z-Level preflight reconstructs its own canonical toolpath,
- multiple Z-Level operations are each validated against their own face IDs,
- switching/view rendering no longer determines which toolpath is checked,
- invalid or missing face targets fail closed.

The current `Fräsen` panel may still consume the viewport-published state; that final export dependency is D3d.
