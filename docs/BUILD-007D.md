# Build 007D — Surface Carve Bearbeiten Product Slice

## Status

Implementation branch. Merge only after explicit approval and real-world acceptance.

## Product scope

007D exposes **Surface Carve** as a separate operation under **Bearbeiten** without changing the primary CAD import model.

Binding rules:

- **Carve** remains the existing planar 2D operation.
- **Surface Carve** is a distinct STEP-only operation.
- **Z-Level Schruppen** remains a separate operation and is never embedded into Surface Carve.
- Surface Carve is offered only when the primary part is STEP/STP.
- The primary **Bauteil** import remains STEP/STP or DXF only.
- Secondary 2D geometry is owned by the individual Surface-Carve operation and is loaded only under **Bearbeiten**.

## Secondary 2D geometry

007D initially accepts **DXF** as the secondary source. The existing `inspect_import` command is reused so the operation receives normalized `PlanarGeometry`; no DXF-specific CAM path is introduced.

The operation persists a source reference plus placement:

- source path
- file name
- X offset
- Y offset
- uniform scale
- rotation

SVG, text and primitives remain future import adapters. They must normalize to the same internal 2D geometry boundary rather than enter the CAM kernel as format-specific concepts.

## Z-Level predecessor

Surface Carve requires an earlier enabled Z-Level-Schruppoperation in `face-target` mode for the same STEP face. The UI lets the operation reference that independent predecessor explicitly.

```text
Z-Level Schruppen
        ↓
Surface Carve
```

The two remain separate job operations with separate parameters, toolpaths and validation.

## Persistence

Project format advances to **V2**. V1 remains loadable and has an explicit V1 → V2 migration path.

The project still contains exactly one primary CAD source. Secondary Surface-Carve sources live inside their owning operations and therefore do not become additional primary parts.

## Safety boundary

007D deliberately stops before production toolpath wiring.

- `buildActiveCanonicalToolpath` returns `null` for Surface Carve.
- Job preflight emits an explicit **FAIL** for Surface Carve.
- No Surface-Carve-specific NC or postprocessor path is added.
- Existing 004T, job G-code and postprocessor behavior remain untouched.

This prevents a partially configured Surface Carve from ever reaching NC output.

The already proven 007B projection/canonical motion core remains the intended production path for the next build.

## Acceptance

Static gates:

```bash
pnpm check:007d
pnpm check:007c
pnpm check
pnpm run build
```

Real-world acceptance:

1. Load a STEP part as the primary Bauteil.
2. Create a Z-Level face-target operation and select a target face.
3. Add Surface Carve as a later, separate operation.
4. Set the same STEP Face ID and reference the earlier Z-Level operation.
5. Load a secondary DXF from the Surface-Carve panel under Bearbeiten.
6. Change X/Y offset, uniform scale and rotation.
7. Save the `.beblogcam` project.
8. Reload it and confirm Surface Carve plus its secondary source and placement are restored.
9. Confirm a DXF primary part does **not** offer Surface Carve.
10. Open Prüfen and confirm Surface Carve fails closed with the explicit 007D production-wiring message.

## Next build

The next build connects the operation-owned normalized 2D geometry and selected STEP face to the existing 007B Surface Carve canonical projection, then integrates that result into the normal preflight / 004T / simulation / NC truth chain.
