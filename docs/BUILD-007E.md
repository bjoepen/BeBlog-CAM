# Build 007E — Surface Carve Projection Integration

## Goal

Connect the 007D Surface Carve product operation to the already proven 007A/007B projection and canonical-motion path.

## Pipeline

```text
secondary DXF
→ normalized PlanarGeometry snapshot
→ Surface Carve placement (X/Y, scale, rotation)
→ planar Carve adapter
→ selected STEP face / Z(x,y) target
→ 007B Surface Carve canonical projection
→ 004T machine-motion truth
→ Preview / Prüfen / Simulation / NC
```

## Binding product rules

- `Carve` and `Surface Carve` remain separate operations.
- Surface Carve remains STEP-only.
- Z-Level Schruppen remains an independent previous operation.
- Surface Carve is released by preflight only if its explicitly referenced previous Z-Level face-target operation is earlier in the job, enabled, targets the same STEP face and has itself passed preflight.
- Secondary DXF remains owned by the Surface-Carve operation under Bearbeiten.
- The CAM core consumes only normalized `PlanarGeometry`; DXF remains an import adapter.

## Geometry snapshot

007E stores the normalized `PlanarGeometry` inside the operation-owned geometry source. The source path and file name are retained for provenance and restoration, while synchronous preview/preflight/NC uses the normalized snapshot.

This avoids filesystem I/O inside the CAM kernel and keeps project V2 self-contained enough for deterministic reconstruction.

## Coordinates

The secondary geometry transform is applied in Surface-Carve/WCS XY:

1. proportional scale,
2. rotation,
3. X/Y offset.

The STEP target is reconstructed using the same part orientation and stock placement convention used by the 3D viewer. The projected result is then converted back to WCS coordinates by the proven 007B adapter.

## Safety

The projected toolpath retains canonical identity:

```text
operationKind: surface-carve
strategy:      surface-carve
```

007B emits explicit XYZ machine motions. 004T validates/materializes the same motion truth used by preview, preflight, simulation and job NC.

No Surface-Carve-specific postprocessor path is introduced; job NC continues to post the validated canonical machine motions generically.

## Gates

```bash
pnpm check:007e
pnpm check:007d
pnpm check:007c
pnpm check
pnpm run build
```

## Real-world acceptance

1. Load a STEP primary part.
2. Create and successfully preflight a face-target Z-Level operation.
3. Add Surface Carve afterward and bind it to the same face / Z-Level operation.
4. Load a secondary DXF.
5. Adjust X/Y, scale and rotation.
6. Under Bearbeiten, confirm a projected Surface-Carve path becomes visible on the STEP model.
7. Confirm changes to placement move the projected path accordingly.
8. Prüfen must no longer fail with the 007D wiring message; it must validate the real canonical Surface-Carve motion.
9. Simulation must use the same motion chain.
10. Fräsen must emit NC only from the accepted preflight motion truth.
11. Removing geometry, choosing an invalid face, projecting outside the selected surface or invalidating the preceding Z-Level operation must fail closed.

Do not merge without explicit approval.
