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
surfaceCarveViewProof.ts
        ↓
GeometryView dedicated preview channel
```

Protected and unchanged in 007A:
- `src/lib/carveCanonicalToolpath.ts`
- `src/lib/safeMotionChain.ts`
- `src/lib/jobPreflight.ts`
- `src/lib/jobGcode.ts`
- `src/lib/postprocessors.ts`

`src/lib/curvedViewCache.ts` is also restored to the exact pre-007A / Build 006C content. It remains responsible only for the established curved-face sampling grid and curved roughing cache.

The projection adapter consumes planar canonical Carve runs read-only. It samples their line/arc geometry and asks the established STEP height-field contract for Z at each XY point.

## Visual proof

An initial experiment appended the Surface-Carve diagnostic path to the existing curved-face sampling cache. This made the proof visually indistinguishable from the target grid and temporarily complicated STEP viewer diagnosis. That approach was rejected.

The final 007A proof is isolated:

- `surfaceCarveViewProof.ts` creates a small deterministic Carve motif inside one real selected STEP triangle;
- the motif is projected through `projectCarveToolpathToSurface()`;
- `GeometryView.svelte` exposes it as `surfaceCarveProofPaths`;
- the established curved-face grid remains `curvedFaceProofPaths`;
- the proof has its own `surface-carve-proof` render class and status text;
- the +0.35 mm Z lift is rendering-only and does not modify projection data or machining geometry.

This separation makes the Real-World proof unambiguous: the normal fine grid represents the STEP Z(x,y) target, while the thicker diagnostic line represents Surface Carve projection.

### Native STEP development requirement
STEP/BRep display requires the native OCCT development path:

```bash
pnpm native:dev
```

A plain `pnpm tauri dev` build does not enable the native OCCT feature and therefore cannot provide STEP display triangles.

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
Default projection sampling is 0.5 mm. The diagnostic proof uses a tighter local sampling value only for visual validation. Sampling is not yet a machining tolerance contract.

## Explicitly out of scope
- SVG import
- secondary decoration-geometry project state
- logo placement UI
- engraving depth relative to the surface
- surface-following CanonicalMachineMotion
- Safe Motion materialization
- G-code / Estlcam output
- stock removal or collision logic

## Acceptance
1. STEP model renders normally when started with `pnpm native:dev`.
2. Existing curved-face target grid remains unchanged.
3. A separately styled Surface-Carve diagnostic motif is visible on the selected STEP surface.
4. Rotating the 3D view shows that the diagnostic motif follows the surface Z contour rather than remaining planar.
5. Projection outside the selected surface still fails closed.
6. Existing planar Carve behavior remains unchanged.
7. `pnpm check:007a`, `pnpm check`, and `pnpm run build` pass.

## Next gate
007A is visually complete only after the dedicated proof passes Real-World acceptance. Only then may 007B turn the proven projection into machining-relevant surface Carve geometry. The Motion Truth invariant remains mandatory.
