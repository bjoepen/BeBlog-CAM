# Build 008A1 — Acceptance Harness

## Status

Implementation slice for Build 008A. Merge only after CI, local checks and explicit approval.

## Goal

Create a small reusable production-acceptance harness without creating a large DXF/NC fixture zoo.

008A1 deliberately does **not** add new CAM behavior. It creates the infrastructure needed by later 008A slices.

## What the harness provides

`scripts/acceptance/harness.mjs` now provides:

- tiny in-code planar geometry factories
- a synthetic DXF-style `ImportSummary` factory
- NC parsing into structured words
- NC motion/statistics helpers
- allowed-command assertions
- Safe-Z checks for XY rapid motion
- spindle-stop-before-tool-change checks
- XY/IJ arc-radius consistency checks
- a compact acceptance-case runner

The in-code geometry is intended to replace most external DXF fixtures in later acceptance tests.

## Boundary

The harness is test infrastructure only. It must not become a second CAM implementation.

It may construct inputs, parse generated NC and assert invariants, but it must not:

- calculate production toolpaths independently
- reconstruct geometry differently from the product
- repair generated NC
- reinterpret postprocessor output
- weaken Canonical Toolpath or 004T checks

Later 008A slices must drive the real production pipeline and use this harness only to make assertions about the result.

## Current self-check

`pnpm check:008a1` verifies the harness itself with a tiny in-memory representative program. No DXF, STEP or `.nc` file is required.

It covers:

- synthetic rectangle geometry
- synthetic drill geometry
- NC parser/statistics
- Estlcam-style command subset
- Safe-Z XY rapid rule
- M5 before M6
- G2/G3 I/J radius consistency

## CI

Build 008 adds two production-readiness checks:

```bash
pnpm check:008a
pnpm check:008a1
```

The first protects the established production architecture. The second protects the reusable acceptance harness.

## Next slice

**008A2 — Synthetic 2D/2.5D production acceptance**

Use the harness to exercise the real production path for the ordinary planar operations while keeping external fixture files to an absolute minimum.
