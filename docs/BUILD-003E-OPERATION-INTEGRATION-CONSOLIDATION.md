# Build 003E — Operation Integration Consolidation

003E closes the two integration gaps found in the read-only audit of snapshot
`9d47ad9`.

## Surface finishing factory

`surface-finishing` now has an explicit `createOperation()` branch. Adding
`3D Schlichten` can no longer fall through to Carve.

## Curved Face Target becomes operation-owned

The already proven kernels `buildCurvedFaceTarget()` and
`buildCurvedFaceRoughing()` are promoted into
`buildCurvedFaceRoughingOperationState()`.

No new roughing geometry is invented.

## Central Z-Level dispatcher

`buildZLevelOperationState()` is now the single source of truth:

- Face Target, planar → established planar path
- Face Target, curved Z(x,y) → proven cove roughing path
- Model → established Stock − Model path

The curved result is translated into normal canonical Z-Level runs in WCS
coordinates, so Bearbeiten, Prüfen and Fräsen can use the same toolpath.

## Regression contract

`scripts/check-003e-contracts.mjs` guards the exact integration failures from
the audit:

- explicit `surface-finishing` factory branch
- curved strategy owned by `buildZLevelOperationState`
- active canonical Z-Level no longer rejects Face Targets

## Functional gate

1. `+ Bearbeitung → 3D Schlichten` creates 3D Schlichten, not Carve.
2. Create two Z-Level operations.
3. Operation A selects the large planar face.
4. Operation B selects the curved cove face.
5. Both operations retain their own face IDs.
6. Both show valid toolpaths independently.
7. Prüfen lists both Z-Level operations.
8. Curved Face Target reaches the existing Face-Target G-code flow.
