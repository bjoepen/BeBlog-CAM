# 001Z-D3d — Operation-owned Preflight and Export

## Prüfen

`05 · Prüfen` is now always the canonical **Gesamtjob** view.

Every enabled operation appears in the operation list with its own PASS/WARN/FAIL state and canonical-path result. This removes the previous ambiguity where the currently selected operation could appear to be the only operation being checked.

## Z-Level export

Z-Level Roughing no longer depends on `GeometryView` publishing a `faceTargetState`.

The active export and the multi-operation job exporter reconstruct directly from:

`STEP BRep + setup + ZLevelRoughingOperation.faceIds`

## Invariant

Viewport state is presentation/editor state only.

It is no longer a source of truth for:

- preflight,
- active Z-Level NC export,
- multi-operation job NC generation.
