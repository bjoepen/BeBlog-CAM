# Build 007C — Surface Carve Operation Contract

## Status

Implementation branch. Merge only after explicit approval.

## Product decision

`Carve` and `Surface Carve` are separate operations.

- **Carve** remains the existing planar 2D operation.
- **Surface Carve** is a STEP-only operation that projects normalized 2D decoration geometry onto one selected STEP/BRep face.
- Surface Carve is never a mode of Carve, Z-Level Roughing, Pocket or Surface Finishing.
- Z-Level Roughing remains an independent operation.

## Mandatory operation order

Surface Carve is only eligible when an earlier, enabled and successful **Z-Level Schruppen** operation exists in `face-target` mode and includes the same STEP face.

The contract receives the successful operation IDs explicitly; mere presence of a Z-Level operation is not enough.

```text
Z-Level Schruppen (independent, successful, same face)
        ↓
Surface Carve (independent operation)
```

## Primary vs. secondary geometry

The primary model remains unchanged:

- `Bauteil` imports only STEP/STP or DXF.
- Surface Carve reserves an operation-owned `geometrySourceId` for secondary 2D geometry.
- That secondary geometry must be loaded under `Bearbeiten`, not under `Bauteil`.
- The actual secondary-import UI and project persistence are intentionally deferred to the next build so the existing import/project model is not widened prematurely.

## Canonical identity

007B proved the XYZ motion mechanics. 007C gives the machining result its own canonical identity:

```text
operationKind: surface-carve
strategy:      surface-carve
```

The normalized planar source passed into the projection adapter remains ordinary canonical `carve` geometry. The projected machining result is no longer labeled as normal Carve.

## Protected boundaries

Unchanged by this build:

- existing planar Carve generation
- `safeMotionChain.ts`
- production `jobPreflight.ts` wiring
- `jobGcode.ts`
- postprocessors
- primary STEP/DXF importer
- existing operation UI

This is intentional. Surface Carve is not exposed in the current operation picker until the Bearbeiten-only secondary 2D geometry source is implemented.

## Gate

```bash
pnpm check:007c
pnpm check
pnpm run build
```

The 007C gate verifies:

1. Surface Carve has a separate operation contract.
2. Surface Carve has a separate canonical operation/strategy identity.
3. normal Carve remains normal Carve.
4. STEP/BRep is required.
5. exactly one target face is required.
6. an earlier successful face-target Z-Level operation on the same face is required.
7. secondary 2D geometry belongs to Bearbeiten.
8. 004T, job preflight, NC and postprocessors are not specialized or bypassed.
9. primary import remains STEP/STP or DXF only.

## Next build

The next build may safely wire Surface Carve into the operation UI together with its operation-owned secondary 2D geometry import, placement/scaling and persistence. Only then should it be inserted into the production preflight chain.
