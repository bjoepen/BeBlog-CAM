# Build 003E2 — Production Hardening Gate

## Purpose

003E2 hardens the already proven 003E/003E1 machining pipeline before merge to
`main`.

No machining geometry changes are introduced.

## 1. Preflight is now an export gate

`generateJobGcode()` runs the same `validateJob()` contract used by `Prüfen`.

If the job Preflight is `FAIL`:

- no G-code is returned,
- `Fräsen` reports FAIL,
- the failing Preflight diagnostics are propagated.

WARN remains exportable and is propagated to the Gesamtjob.

## 2. Physical tool identity

Preflight and Gesamtjob previously identified tools by:

`name + diameter`

That was insufficient.

Both now use the shared `toolIdentityKey()` contract:

`tool.id + tool.kind + diameter + name`

This prevents a same-name/same-diameter end mill and ballnose cutter from being
mistaken for the same physical tool.

The defensive inclusion of kind and diameter also prevents an inconsistent tool
library record from silently suppressing a required tool change.

## 3. Regression suite

`scripts/test-003e2-production-hardening.mjs` is executable with plain Node and
requires no new test dependency.

It verifies:

- same name/diameter but different tool ID/kind => different tool,
- identical physical tool metadata => same tool,
- inconsistent kind with same ID => different tool,
- Preflight and Gesamtjob use the shared identity helper,
- Gesamtjob has a hard Preflight FAIL gate,
- Fräsen exposes the shared release contract,
- App keeps Gesamtjob as the primary export path.

## 4. Cleanup

Unused single-operation G-code panel imports are removed from `App.svelte`.

The individual panel files remain in the repository and can be reused later if
an explicit “export only this operation” feature is desired.

## 5. M30 contract

The canonical/raw Gesamtjob has one final `M30`.

Controller postprocessors may transform the ending. In particular, the Estlcam
postprocessor intentionally removes `M30` and ends conservatively with `M5`.

## Gate before merge

- `pnpm check`
- `pnpm build`
- `node scripts/check-003e-contracts.mjs`
- `node scripts/test-003e2-production-hardening.mjs`
- real CBG Headstock smoke test:
  - expected operation count,
  - expected tool-change count,
  - `Prüfen` FAIL must block `Fräsen`,
  - WARN may export with warning,
  - valid job exports normally.
