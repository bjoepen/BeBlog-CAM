# Build 007A — STEP Surface Carve Projection

## Goal
Prove that planar Carve geometry can be projected onto an already-selected STEP/BRep surface without changing the working CAM kernel.

007A is deliberately preview-only. It does not generate a new machining operation, Safe Motion, NC code, or postprocessor output.

## Architecture boundary

```text
planar Carve geometry
        ↓
surfaceCarveProjection.ts
        ↓
CurvedFaceTarget / curvedFaceTargetZAt(x,y)
        ↓
preview-only 3D polylines
```

Protected and unchanged in 007A:
- `src/lib/curvedViewCache.ts`
- `src/lib/carveCanonicalToolpath.ts`
- `src/lib/safeMotionChain.ts`
- `src/lib/jobPreflight.ts`
- `src/lib/jobGcode.ts`
- `src/lib/postprocessors.ts`

The projection adapter consumes planar canonical Carve runs read-only. It samples their line/arc geometry and asks the established STEP height-field contract for Z at each XY point.

## Viewer isolation correction

An initial visual-proof experiment wired diagnostic Surface-Carve geometry into `curvedViewCache.ts`. In Real-World testing the STEP model then loaded but was no longer displayed. That experiment was rejected and removed.

`curvedViewCache.ts` is restored to the exact pre-007A / Build 006C content. The 007A contract gate now explicitly fails if Surface-Carve projection is wired into that established viewer cache again.

The projection adapter itself remains valid and isolated. A future visual proof must use a separate preview/UI path rather than modifying the stable curved STEP viewer cache.

### Important current product boundary
BeBlog CAM currently owns one `ImportSummary` at a time. A STEP model and a second DXF/SVG logo therefore cannot yet coexist as independent geometry sources in the same project state.

007A does **not** solve that by changing the CAM kernel. A later import/UI layer may add secondary decoration geometry. Surface Carve itself remains source-agnostic: once geometry is normalized to planar Carve geometry, the projection adapter does not care whether it originated from DXF, SVG, text, or another source.

## Fail-closed behavior
- only `operationKind === 'carve'` is accepted;
- the selected STEP target must already be valid;
- if any sampled point cannot be resolved on the selected surface, projection fails;
- no extrapolation outside the selected face is allowed;
- no CAM or NC fallback is attempted.

## Sampling
Default preview sampling is 0.5 mm. A caller may provide another positive `sampleSpacingMm` value. Sampling exists only to create a deterministic preview geometry; it is not yet a machining tolerance contract.

## Explicitly out of scope
- SVG import
- secondary decoration-geometry project state
- logo placement UI
- engraving depth relative to the surface
- surface-following CanonicalMachineMotion
- Safe Motion materialization
- G-code / Estlcam output
- stock removal or collision logic
- modifying the established curved STEP viewer cache for the visual proof

## Acceptance status
1. Projection adapter contract: implemented.
2. Kernel / 004T / preflight / NC isolation: implemented.
3. Existing STEP viewer regression: corrected by restoring `curvedViewCache.ts` to Build 006C.
4. Visual Real-World proof: still open and must be implemented through an isolated preview/UI path.
5. `pnpm check:007a`, `pnpm check`, and `pnpm build` must pass after the correction.

## Next gate
007A is not considered visually complete until a separate viewer/UI proof exists and passes Real-World acceptance. Only after that PASS may 007B turn the proven projection into machining-relevant surface Carve geometry. The Motion Truth invariant remains mandatory.
