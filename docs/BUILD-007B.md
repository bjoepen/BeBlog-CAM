# Build 007B — Surface Carve Canonical Motion

## Goal
Turn the visually proven 007A STEP Surface-Carve projection into machining-relevant canonical XYZ geometry without changing the working CAM kernel or canonical vocabulary.

007B deliberately stops at the canonical-motion adapter boundary. It does not yet solve the product-state problem of loading a STEP model and an independent DXF/SVG decoration source at the same time.

## Architecture

```text
existing planar Canonical Carve (WCS)
        ↓
WCS XY → stock/world XY
        ↓
007A surface projection / curvedFaceTargetZAt(x,y)
        ↓
local Carve depth added to projected STEP surface Z
        ↓
world XYZ → WCS XYZ
        ↓
Canonical Carve runs with cutSegments3
        ↓
explicit CanonicalMachineMotion chain
        ↓
004T validation in normal preflight (later integration)
        ↓
Preview / Prüfen / Simulation / NC
```

## Depth semantics
The existing planar Carve toolpath remains the source of engraving depth.

A source run already carries a negative canonical Z value. 007B interprets this as **depth relative to the local STEP surface**:

```text
Zcut(world) = Zsurface(world XY) + sourceRun.z
Zcut(WCS)   = Zcut(world) - WCS origin Z
```

This preserves the existing Carve depth / step-down semantics instead of inventing a second depth model for Surface Carve.

## Coordinate contract
- incoming planar Carve geometry is canonical WCS geometry;
- `CurvedFaceTarget` is reconstructed in stock/world coordinates;
- 007B adds the WCS XY origin before projection;
- projected XYZ is converted back to WCS after projection;
- no coordinate-system change is emitted into NC.

## Canonical output
007B keeps:
- `operationKind: 'carve'`
- `strategy: 'carve'`

Each projected run contains:
- WCS XY points;
- `cutSegments3` with the real varying surface-following Z;
- feed values on the spatial cut segments.

The toolpath also contains one explicit, continuous `motions` chain:
- safe-Z XY rapid between runs;
- plunge from safe Z to the first surface-relative cut point;
- surface-following `line3` cuts;
- retract back to safe Z.

The first motion starts on `safeZMm`; the final motion ends on `safeZMm`.

## Why 004T is not called inside the adapter
004T remains owned by normal preflight. 007B creates canonical machine-motion truth; it does not bypass or duplicate the safety gate.

When 007B is integrated into the operation workflow, preflight will still call `materializeSafeMotionChain()`. Because the toolpath already contains explicit canonical motions, 004T validates continuity and finite XYZ coordinates rather than reconstructing another path.

## Protected boundaries
007B does not modify:
- `src/lib/canonicalToolpath.ts`
- `src/lib/safeMotionChain.ts`
- `src/lib/jobPreflight.ts`
- `src/lib/jobGcode.ts`
- `src/lib/postprocessors.ts`
- existing planar Carve generation.

No `surface-carve` operation kind or strategy is added.

## Fail-closed behavior
007B fails if:
- input is not canonical Carve geometry;
- the STEP target is invalid;
- feed / plunge / safe-Z are invalid;
- any projected sample leaves the selected STEP surface;
- a source run has an invalid positive relative cut depth;
- the generated canonical motion chain is discontinuous or non-finite.

## Explicitly out of scope for 007B
- SVG import
- second geometry source in project state
- logo placement / scaling UI
- choosing a STEP target from a Carve operation in the current UI
- automatic source-to-surface registration
- cutter-shape compensation normal to the surface
- V-carve depth-by-width logic on curved surfaces
- direct NC generation inside the adapter.

## Acceptance gate
Before 007B may be integrated into `jobPreflight.ts` or UI:
1. `pnpm check:007b` passes;
2. `pnpm check` passes;
3. `pnpm build` passes;
4. CI passes;
5. a deterministic fixture proves varying projected Z while preserving source Carve depth;
6. explicit motions begin/end on safe Z and remain continuous;
7. existing 007A, 004T, Preview, Simulation and Estlcam gates stay green.

## Next product step
After 007B core acceptance, the next build may add the missing **secondary decoration geometry / Surface-Carve operation state**. That layer may accept DXF first and SVG later, but it must normalize geometry before the CAM path and must not push SVG concepts into the CAM kernel.
