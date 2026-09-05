# Build 003D3b — 3D Finishing Operation Contract

## Goal

Create a first-class CAM operation for finishing selected curved STEP/BRep
surfaces with a ballnose cutter.

Operation:

`3D Schlichten`

## Operation-owned state

The operation stores:

- selected `faceIds`
- tool
- stepover percentage
- finishing direction (`Parallel X` / `Parallel Y`)
- feed / plunge / spindle / safe Z

The selected STEP surface therefore belongs to the operation rather than the
viewport.

## Tool contract

`3D Schlichten` requires a `ball-nose` tool.

Other tool kinds fail the common tool-compatibility gate.

## UI

The operation is available beside the existing CAM operations.

In `Bearbeiten`:

- select `3D Schlichten`
- select one or more STEP/BRep faces
- choose Parallel X/Y
- choose stepover
- assign a ballnose cutter via the existing Werkzeug workflow

## Preflight / export behavior

003D3b deliberately has **no canonical finishing path yet**.

Therefore:

- the operation exists and is selectable,
- tool/selection/common validation is active,
- Job Preflight reports FAIL with an explicit 003D3c pending message,
- G-code export is blocked.

This prevents an incomplete finishing operation from silently falling through
to another strategy.

## Next

003D3c will generate the canonical parallel ballnose finishing path from the
selected curved face using the proven 003D3a contact compensation kernel.
