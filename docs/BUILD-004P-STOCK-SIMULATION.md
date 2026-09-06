# Build 004P — Stock Simulation / Rest Stock Model v1

## Goal
Create a deterministic 2.5D stock state from the defined stock and the canonical toolpaths already accepted by Job Preflight.

## Included
- WCS-aware XY stock bounds.
- Heightfield stock model with deterministic cell size.
- Tool-radius swept removal for canonical cutting runs.
- Stock thickness clamp: simulation never removes material below the defined stock bottom.
- Per-job accumulation in operation order.
- Approximate initial, remaining and removed stock volume.
- Removed stock percentage and touched-cell count.
- Job Preflight exposes a compact stock-simulation summary.
- `stockMode: none` skips stock simulation.
- Z-zero on stock bottom is not simulated in v1; Preflight reports a warning instead of inventing a false result.

## Scope / limitations
004P v1 is a 2.5D heightfield model. It intentionally does not claim full volumetric/voxel simulation. Undercuts, holder geometry, side-wall collisions and true 3D swept solids remain outside this build. Entry/exit motions are not used as the primary stock-removal source; accepted canonical cut runs are the manufacturing truth for this first model.

## Why this matters
004N and 004O can reason about previous cutting paths. 004P adds a persistent material-state representation that later builds can use for visual rest-stock display, holder/tool collision checks and stronger rest-machining decisions.

## Local-first gates
```bash
pnpm check:004p
pnpm check
pnpm build
```

No native OCCT change is included; `pnpm native:test` is not required.
