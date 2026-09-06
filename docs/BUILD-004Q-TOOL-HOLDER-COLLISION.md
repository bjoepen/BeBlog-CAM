# Build 004Q — Tool Reach & Holder Collision Preflight v1

## Goal
Use the 004P rest-stock heightfield to detect unsafe tool reach and basic holder-to-stock collisions before G-code release.

## Included
- Explicit tool-assembly geometry contract: cutting length, stickout, shank diameter and holder diameter.
- Canonical-toolpath based reach validation.
- Hard FAIL when requested cutting depth exceeds configured stickout.
- WARN when cutting depth exceeds configured cutting length.
- Conservative holder collision check against the deterministic 004P rest-stock heightfield before the current operation.
- Holder collision checks the annulus outside the cutter radius up to the holder radius; the cutter corridor itself is not misreported as a holder collision.
- WCS-aware stock bounds.
- Z-zero on stock bottom remains unsupported for this v1 check and fails explicitly instead of inventing geometry.

## Scope / limitations
004Q v1 is a 2.5D safety gate, not a full machine simulation. It does not yet model tapering holders, collets, spindle noses, fixtures, clamps, machine axes or true 3D swept solids. Fixture/clamp geometry is intentionally reserved for the next production-safety block.

The kernel is deliberately separate from posting. It consumes accepted canonical toolpaths and the existing 004P stock truth, so DXF and STEP operations can share the same safety model once operation/UI wiring is added.

## Next integration step
Add tool-assembly values to operation/tool configuration, run 004Q sequentially in Job Preflight using only previously accepted operations as rest-stock history, and expose failures/warnings in the Prüfen step.

## Local-first gates
```bash
pnpm check:004q
pnpm check
pnpm build
```

No native OCCT change is included; `pnpm native:test` is not required.
