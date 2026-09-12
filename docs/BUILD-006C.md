# Build 006C — Pocket Through-Cut Allowance

## Goal
Allow a DXF pocket that nominally reaches the material bottom to cut a small, explicit distance deeper so minor stock/fixture flatness errors do not leave a thin uncut skin.

Example: 3.00 mm aluminium + 0.15 mm through-cut allowance => effective pocket depth 3.15 mm.

## Product language
The UI calls this **Durchfräszugabe**. It is a Z-depth allowance and is deliberately separate from corner overcut / dogbone geometry.

## Contract
- `PocketOperation.throughCutAllowanceMm` persists the value; default is `0`.
- For DXF pockets, effective depth is `totalDepthMm + throughCutAllowanceMm`.
- The allowance is applied before canonical pocket generation.
- 006B multi-target pockets use the same pocket builder, so every target in the operation receives the same effective depth.
- 004T remains the sole Safe Motion materialization boundary.
- Preview, Prüfen, Simulation and NC continue to consume the same canonical truth.
- Postprocessors contain no 006C special case.
- STEP face-target pockets are unchanged in 006C because their target depth is geometry-derived rather than a 2D stock-through depth.

## Safety / UX
- Default `0.00 mm`: no behavioral change for existing projects.
- Negative values are rejected by the UI.
- Values above 1.00 mm produce an explicit warning to review sacrificial board and workholding.
- The effective depth is reported through the pocket-state warning/detail path and is therefore visible during verification.

## Acceptance
1. DXF pocket depth 3.00 mm, allowance 0.00 mm => final Z remains -3.00 mm.
2. Same pocket with 0.15 mm => final canonical/NC Z is -3.15 mm.
3. Multi-target pocket applies -3.15 mm to every selected target.
4. Preview / Prüfen / Simulation agree with NC.
5. Save/reopen preserves 0.15 mm.
6. Existing projects without the field behave as 0.00 mm.
