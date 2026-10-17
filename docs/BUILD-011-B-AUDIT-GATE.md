# 011-B Audit Gate — Draft PR #148

Status: **HOLD — do not merge yet**.

## Reviewed

- PR changes only `src/lib/advisorStepFeasibility.ts`; production CAM kernel and validators are unchanged.
- The advisor uses existing STEP manufacturing feature extraction, hole recognition and tool compatibility.
- Audit correction: `warn` compatibility must not be silently upgraded to `pass`.
- Audit correction: dimensional screening is not full preflight; axial drilling remains conditional until depth, point geometry, setup and clearance are verified.

## Remaining acceptance gaps

1. **Executable regression tests** have been added in `scripts/check-011b-advisor-regression.mjs` (14 isolated cases; run `pnpm check:011b`), but CI execution and results remain unverified. Previously missing cases included for recognized Ø4 hole / Ø4 drill, Ø3 end-mill helix alternative, wrong diameter, insufficient cutting length, insufficient stickout, invalid WCS, missing stock, unsupported DXF, rejected cylindrical faces and read-only behavior.
2. **Status semantics:** `DIRECT` and `ALTERNATIVE` should be reserved for verified capability, not merely candidate geometry. Current screen intentionally emits `CONDITIONAL` for unverified drilling.
3. **Coverage:** report evaluates holes and rejected cylinders only; other BRep faces, pockets and contours remain unassessed. No overall manufacturability claim is permitted.
4. **Freshness:** report does not yet bind to source geometry identity, tool library snapshot, stock dimensions, setup and operation capability version. Do not cache or persist as valid after changes.
5. **Tool constraints:** stickout/cutting length checks are necessary but insufficient for collision, drill point, tool shank/holder and material suitability.
6. **Validation boundary:** existing `validateToolCompatibility` is reused; full operation grammar and actual STEP operation checks are not run. This is a screen, not preflight.

## Merge gate

- Run `pnpm check:011b` and confirm all isolated regression cases pass; follow up with integration-level native STEP fixtures.
- Verify current CI on the final head SHA.
- Re-audit output semantics and missing-coverage behavior.
- Only then mark ready and merge. Keep the PR as Draft until the gate passes.
