# Build 003D4b — Surface Finishing G-code UI Release

## Goal

Expose the already proven and preflight-approved 3D surface-finishing canonical
toolpath in the normal `Fräsen` workflow.

## Single-source contract

The panel reconstructs:

`buildSurfaceFinishingOperationState(...)`

and posts:

`postSurfaceFinishingCanonicalToolpath(...)`

No new geometry or toolpath logic is created in the UI.

## Postprocessor chain

Raw controller-neutral G0/G1 XYZ code is passed through the existing:

`postProcessGcode(rawCode, selectedPostProcessor)`

workflow and uses the normal `PostProcessorPicker`.

## UI

The panel reports:

- finishing chain count
- contact-point count
- XYZ cutting motion count
- safe rapid count
- ballnose diameter
- Parallel X/Y strategy
- stepover
- safe Z

It supports:

- postprocessor selection
- G-code preview
- clipboard copy
- `.nc` save

## Gate

PASS requires:

- `Fräsen` opens `3D Schlichten`, not Carve.
- panel reports PASS for the approved cove operation.
- preview contains variable `G1 X... Y... Z...`.
- safe linking/retracts appear as `G0`.
- postprocessor picker remains functional.
- saving an `.nc` file works.
