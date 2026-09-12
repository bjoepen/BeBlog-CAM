# Build 007A — STEP Surface Carve Projection

## Goal
Prove that existing planar Carve geometry can be projected onto an already-selected STEP/BRep surface without changing the working CAM kernel.

007A is deliberately preview-only. It does not generate a new machining operation, Safe Motion, NC code, or postprocessor output.

## Architecture boundary

```text
existing Carve geometry
        ↓
surfaceCarveProjection.ts
        ↓
CurvedFaceTarget / curvedFaceTargetZAt(x,y)
        ↓
preview-only 3D polylines
```

Protected and unchanged in 007A:
- `src/lib/carveCanonicalToolpath.ts`
- `src/lib/safeMotionChain.ts`
- `src/lib/jobPreflight.ts`
- `src/lib/jobGcode.ts`
- `src/lib/postprocessors.ts`

The projection adapter consumes the existing planar canonical Carve runs read-only. It samples their line/arc geometry and asks the established STEP height-field contract for Z at each XY point.

## Fail-closed behavior
- only `operationKind === 'carve'` is accepted;
- the selected STEP target must already be valid;
- if any sampled point cannot be resolved on the selected surface, projection fails;
- no extrapolation outside the selected face is allowed;
- no CAM or NC fallback is attempted.

## Sampling
Default preview sampling is 0.5 mm. A caller may provide another positive `sampleSpacingMm` value. Sampling exists only to create a deterministic visual proof over lines and arcs; it is not yet a machining tolerance contract.

## Explicitly out of scope
- SVG import
- logo placement UI
- engraving depth relative to the surface
- surface-following CanonicalMachineMotion
- Safe Motion materialization
- G-code / Estlcam output
- stock removal or collision logic

Those only become eligible after the visual projection itself passes Real-World acceptance.

## Acceptance
1. Existing planar Carve geometry projects onto a selected planar/sloped STEP face.
2. On a curved valid STEP face, projected preview points exhibit varying Z.
3. A path extending beyond the selected surface fails with a concrete XY location.
4. Existing planar Carve behavior remains unchanged.
5. `pnpm check:007a`, `pnpm check`, and `pnpm build` pass.

## Next gate
Only after 007A visual PASS may 007B turn the proven projection into machining-relevant surface Carve geometry. The Motion Truth invariant remains mandatory.
