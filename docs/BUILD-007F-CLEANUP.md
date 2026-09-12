# Build 007F — Surface Carve Cleanup

Status: implementation branch. Merge only after explicit approval.

## Decision

Surface Carve is removed as a product feature after Build 007E failed real-world acceptance. A circular DXF projected onto a planar STEP face did not preserve the expected planar geometry when viewed from the model front. The feature is therefore not production-safe or product-appropriate for BeBlog CAM's 3-axis maker scope.

## Cleanup strategy

007F restores the product-facing files changed by 007C/007D to the known-good post-007B state. This deliberately keeps the isolated 007A/007B projection/canonical experiments in the repository, but removes their product exposure.

## Cleanup goals

- remove Surface Carve from the Bearbeiten operation UI
- remove Surface Carve from the product operation model
- remove operation-owned secondary DXF configuration used only by Surface Carve
- remove Surface-Carve-specific production/preflight guards introduced by 007D
- preserve ordinary Carve unchanged
- preserve Z-Level Schruppen unchanged and standalone
- return project persistence to the post-007B V1 contract
- keep experimental 007A/007B projection helpers isolated from the product pipeline

## Project persistence

The V2 project format existed only to persist the experimental 007D Surface-Carve operation. Because that product feature is now rejected, 007F deliberately returns persistence to the post-007B V1 contract. Experimental `.beblogcam` files saved specifically with 007D/V2 are therefore not part of the supported product format after cleanup.

## Non-goals

- no changes to ordinary Carve
- no changes to Z-Level roughing
- no postprocessor changes
- no changes to 004T safe motion
- no attempt to repair or redesign Surface Carve

## Acceptance

1. Surface Carve is no longer offered under Bearbeiten.
2. Existing ordinary Carve remains available and behaves unchanged.
3. Z-Level Schruppen remains available and behaves unchanged.
4. STEP and DXF remain the only primary part import formats.
5. Prüfen/Fräsen contain no product-facing Surface-Carve path.
6. Project persistence is back at V1, matching the known-good post-007B product state.
7. 007A/007B helpers remain experimental only and are not reachable from the active product operation pipeline.
8. Static gates, `pnpm check`, frontend build and Rust check pass.
