# Build 007F — Surface Carve Cleanup

Status: implementation branch. Merge only after explicit approval.

## Decision

Surface Carve is removed as a product feature after Build 007E failed real-world acceptance. A circular DXF projected onto a planar STEP face did not preserve the expected planar geometry when viewed from the model front. The feature is therefore not production-safe or product-appropriate for BeBlog CAM's 3-axis maker scope.

## Cleanup goals

- remove Surface Carve from the Bearbeiten operation UI
- remove Surface Carve from the product operation model
- remove operation-owned secondary DXF configuration used only by Surface Carve
- remove Surface-Carve-specific production/preflight guards introduced by 007D
- remove the obsolete Bearbeiten viewer control `Gekrümmte Zielfläche`; it is a development/proof control and not part of the 3D production workflow
- preserve ordinary Carve unchanged
- preserve Z-Level Schruppen unchanged and standalone
- preserve existing project files safely where practical
- keep experimental 007A/007B projection helpers isolated unless they are coupled into product code

## Non-goals

- no changes to ordinary Carve
- no changes to Z-Level roughing
- no postprocessor changes
- no changes to 004T safe motion
- no attempt to repair or redesign Surface Carve

## Acceptance

1. Surface Carve is no longer offered under Bearbeiten.
2. The viewer control `Gekrümmte Zielfläche` is no longer exposed under Bearbeiten.
3. Existing ordinary Carve remains available and behaves unchanged.
4. Z-Level Schruppen remains available and behaves unchanged.
5. STEP and DXF remain the only primary part import formats.
6. Prüfen/Fräsen contain no product-facing Surface-Carve path.
7. Existing V1 project parsing remains fail-safe; removed Surface-Carve operations are not revived into an active production path.
8. Static gates, `pnpm check`, frontend build and Rust check pass.

## Persistence decision

Build 007D introduced project format V2 only to persist Surface-Carve-owned secondary DXF geometry. Because Surface Carve is rejected and 007D's product slice is being removed, 007F restores the known-good post-007B V1 persistence contract. Experimental 007D/V2 project files are not retained as a supported product format.
