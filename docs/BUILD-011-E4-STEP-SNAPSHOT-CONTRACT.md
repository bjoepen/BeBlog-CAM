# Build 011-E4 — Immutable STEP import snapshot contract

## Decision

011-E3's before/after SHA-256 verification is a useful mutation detector but **not** a transactional guarantee that OCCT inspected the bytes identified by `sourceContentSha256`. The OCCT 8 bridge currently accepts a **path** and opens that path itself. A same-path source can change and revert between reads (ABA), and a final check cannot close the last race.

**Use a private, immutable-for-the-import snapshot for STEP/STP.** Treat snapshot creation, hashing, native inspection and cleanup as one bounded import transaction. Do not wire the Advisor until this is implemented and tested.

## Required data flow

1. Resolve and validate the user-selected STEP/STP source; preserve the original filename in the user-facing summary.
2. Read the source bytes into a bounded, owned snapshot (avoid an unbounded in-memory allocation). The snapshot must be a private file with an appropriate STEP/STP extension because OCCT currently consumes a path. Create it exclusively; do not reuse a predictable shared pathname.
3. Derive the **legacy `src-v1` fingerprint** and the **SHA-256** from the *same snapshot bytes*. Preserve the existing `src-v1` encoding exactly; do not migrate saved projects implicitly.
4. Supply only the snapshot path to `Occt8Backend.inspect_step`, never the original source path. Keep the snapshot alive through native inspection and remove it on all return paths (RAII cleanup).
5. Check the original source against the snapshot identity before publishing the result. If it changed, fail closed. This final source check is a best-effort user-file freshness check, **not** the proof of snapshot-to-geometry identity.
6. Return `sourceContentSha256` only with the snapshot-derived identity and successful native inspection. Preserve the existing `native-adapter-pending` behavior where native OCCT is unavailable, but do not label pending geometry as verified.

## Security / failure boundaries

- OCCT must not reopen the original source through an alternate path or external reference. Investigate STEP external references and bridge behavior before claiming complete isolation.
- Snapshot directory and permissions must prevent other processes from modifying or substituting the snapshot in ordinary use; a path alone does not provide cryptographic immutability against privileged local actors.
- Defend against symlinks, filename collisions, incomplete writes, disk exhaustion and cleanup failures. Prefer OS-managed temporary-file facilities; do not silently overwrite existing files.
- Source-file changes after the final freshness check cannot be excluded. The **geometry/hash** invariant is independent of those changes because OCCT reads the snapshot.
- Keep DXF, CAM/NC, saved project schema and Advisor UI outside this milestone.

## Acceptance gates

- A stable STEP source yields a snapshot SHA-256 matching the bytes OCCT is handed.
- Mutating the original source after snapshot capture does not mutate the bytes presented to the native importer.
- Source changes detected before result publication reject the import.
- Snapshot creation, native failure and early returns clean up temporary files.
- Native disabled/pending, non-UTF-8 paths and invalid source handling are covered.
- Legacy `src-v1` compatibility is demonstrated with regression vectors.
- CI PASS and read-only audit PASS; no merge without explicit authorization.

## Status

Architecture/contract only. **No production snapshot code is implemented in this PR.** The next implementation milestone is 011-E4B.
