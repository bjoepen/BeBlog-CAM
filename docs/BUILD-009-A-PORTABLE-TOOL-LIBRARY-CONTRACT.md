# Build 009-A – Portable Tool Library Contract

Status: approved contract baseline  
Scope: contract only; no CAM strategy, feeds/speeds or material-profile changes

## Purpose

BeBlog CAM already has a working local tool library. Build 009 does not replace it. It makes the existing library portable and versionable so a real workshop inventory can be exported, backed up, shared and imported without creating a second tool model.

## Existing source of truth

The internal milling-tool model in `src/lib/toolTypes.ts` remains the source of truth.

Existing tool kinds remain valid:

- `end-mill`
- `ball-nose`
- `face-mill`
- `v-bit`

Existing operation behavior remains unchanged: an operation owns a tool snapshot. A library entry is reusable master data, not a live pointer whose later edits silently mutate old jobs.

The existing feeds/speeds path remains unchanged. Tool data supplies geometry and base chip load; the stock material context supplies cutting speed and chip-load factor; machine limits constrain the result.

Material profiles, including `steel`, are explicitly outside 009-A and remain available.

## Portable file envelope

A portable tool-library file MUST use an explicit envelope rather than exporting the LocalStorage array verbatim.

Canonical shape:

```json
{
  "schema": "beblog-cam-tool-library",
  "version": 1,
  "tools": []
}
```

Rules:

1. `schema` MUST equal `beblog-cam-tool-library`.
2. `version` MUST be a positive integer.
3. `tools` MUST be an array.
4. Version 1 tool entries use the canonical `MillingTool` representation.
5. Tool IDs MUST be preserved on export/import.
6. Import MUST validate the envelope before changing the local library.
7. Unsupported future versions MUST fail safely rather than being interpreted as version 1.
8. Existing `migrateMillingTool()` remains the compatibility boundary for legacy tool records where applicable.
9. Export order SHOULD preserve current library order for deterministic human-readable files.
10. Import/export MUST NOT modify operations, material profiles, CAM parameters or toolpaths.

## Persistence boundary

Current LocalStorage key:

`beblog-cam.tool-library.v1`

remains an implementation detail for local persistence.

The portable file format is a separate public contract. A future change to browser/WebView storage MUST therefore not require changing exported library files.

## Import semantics

009-A defines validation behavior but does not yet choose a final UI merge policy.

Before any import write:

- parse JSON;
- validate envelope/schema/version;
- migrate and validate every tool;
- reject the import atomically if the document is malformed or contains an invalid/unmigratable tool.

No partial import is allowed.

The subsequent implementation step MUST make replacement/merge behavior explicit to the user. It MUST NOT silently overwrite an existing tool with the same ID.

## Tool identity

Stable `id` remains part of the portable tool record.

The current defensive operation/tool-change identity logic remains untouched. Portable library identity does not change the rule that operations contain reproducible snapshots.

## Future tool kinds

009-A does not add tool kinds. The real workshop inventory will be used to determine which additional kinds are actually required.

Likely candidates such as drills, spot drills or wood-specific cutters MUST be added only after their geometry and CAM meaning are defined. They MUST NOT be represented by arbitrary labels that bypass the typed model.

Nickname/brand/storage metadata may be considered later, but must not be confused with machining geometry.

## Non-goals

009-A explicitly does not:

- add trochoidal milling;
- add chamfering;
- change feeds/speeds formulas;
- change material profiles;
- remove steel;
- alter machine limits;
- change generated toolpaths;
- replace operation tool snapshots with live library references;
- invent an external tool database.

## Acceptance criteria for subsequent implementation

A conforming implementation must demonstrate that:

1. a current local library can be exported to the version-1 envelope;
2. the exported file can be imported into an empty library without loss of canonical tool data;
3. malformed schema/version/tool data is rejected without changing the existing library;
4. duplicate-ID handling is explicit and non-destructive by default;
5. existing projects and operation snapshots behave exactly as before;
6. feeds/speeds results are unchanged for identical inputs;
7. the current four tool kinds round-trip successfully;
8. legacy LocalStorage libraries continue to load through the existing migration path.

## Real-world follow-up

After the portable contract is implemented, a representative sample of the actual workshop inventory should be used to drive any type expansion: flat end mills, ball-nose cutters, wood/fibre cutters, spot drills, surfacing cutters and other genuinely present tools.

The contract should fit the workshop, not force the workshop into demo data.
