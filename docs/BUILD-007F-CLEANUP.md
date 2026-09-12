# Build 007F — Surface Carve Cleanup

Status: implementation branch. Merge only after explicit approval.

## Decision

Surface Carve is removed as a product feature after Build 007E failed real-world acceptance. A circular DXF projected onto a planar STEP face did not preserve the expected planar geometry when viewed from the model front. The feature is therefore not production-safe or product-appropriate for BeBlog CAM's 3-axis maker scope.

A follow-up audit of the STEP viewport controls found a second cleanup class: several controls beside the rejected Surface Carve proof are legacy development/visual-proof toggles rather than production CAM controls. They are removed from the product-facing UI while their underlying research kernels remain available in the repository.

## Cleanup goals

- remove Surface Carve from the Bearbeiten operation UI
- remove Surface Carve from the product operation model
- remove operation-owned secondary DXF configuration used only by Surface Carve
- remove Surface-Carve-specific production/preflight guards introduced by 007D
- retire the complete STEP proof-control group from the product UI:
  - `Gekrümmte Zielfläche` — 003D1b proof
  - `Hohlkehle Schruppen` — 003D2 visual proof
  - `Ballnose Kontakt` — 003D3a2 visual proof
  - `Modellregionen` — 003A2 read-only geometry proof
  - `Stock − Model` — 003B2 read-only geometry proof
  - `Modell-Schruppbahn` — 003C2 read-only canonical-toolpath proof
- preserve ordinary Carve unchanged
- preserve Z-Level Schruppen unchanged and standalone
- preserve 3D Schlichten unchanged
- preserve existing project files safely where practical
- keep experimental 007A/007B projection helpers isolated unless they are coupled into product code

## Proof-control boundary

The retired controls are not production operations. The historical build contracts explicitly describe them as read-only or visual proofs; several do not generate NC at all. Removing the controls from the product UI does not remove the actual `Z-Level Schruppen` or `3D Schlichten` operation pipelines.

The first cleanup attempt removed a Svelte-owned button node at runtime. Real-world acceptance showed that this was brittle. 007F therefore leaves the legacy proof nodes under component ownership and hides the retired controls in-place from the product-facing UI.

## Non-goals

- no changes to ordinary Carve
- no changes to Z-Level roughing
- no changes to 3D Schlichten
- no postprocessor changes
- no changes to 004T safe motion
- no attempt to repair or redesign Surface Carve

## Acceptance

1. Surface Carve is no longer offered under Bearbeiten.
2. None of the six retired STEP visual-proof controls is exposed in the product UI.
3. Orbit controls, zoom and reset remain available.
4. Existing ordinary Carve remains available and behaves unchanged.
5. Z-Level Schruppen remains available and behaves unchanged.
6. 3D Schlichten remains available and behaves unchanged.
7. STEP and DXF remain the only primary part import formats.
8. Prüfen/Fräsen contain no product-facing Surface-Carve path.
9. Existing V1 project parsing remains fail-safe; removed Surface-Carve operations are not revived into an active production path.
10. Static gates, `pnpm check`, frontend build and Rust check pass.

## Persistence decision

Build 007D introduced project format V2 only to persist Surface-Carve-owned secondary DXF geometry. Because Surface Carve is rejected and 007D's product slice is being removed, 007F restores the known-good post-007B V1 persistence contract. Experimental 007D/V2 project files are not retained as a supported product format.
