# Development 011-A — CAM Advisor Feasibility Contract (Draft)

Status: proposal / read-only foundation. No CAM kernel changes authorized by this document.

## Product goal

Before CAM operation planning, help a user assess whether recognized STEP geometry can plausibly be machined using the defined stock, selected material, existing tool library, and **currently implemented** BeBlog CAM operations. Report evidence, limitations, and missing resources. The advisor does not create NC code, automatically add operations, or guarantee manufacturability.

## Immutable architecture boundary

- Do not modify existing CAM toolpath generators, canonical toolpath semantics, geometry import/parsing, preflight validation, or NC postprocessors to accommodate the advisor.
- Read existing project, setup, STEP/BRep, material, tool, and operation capability data through read-only adapters.
- Keep advisor findings separate from the authoritative CAM/preflight result. A feasibility suggestion is **not** a machining approval.
- Any future user-initiated adoption of a suggestion must pass through existing operation contracts and normal preflight/simulation/export gates.
- Do not invoke store-mutating operation helpers from analysis.

## First study scope

- STEP input only, one setup / machining orientation, explicit stock and material, existing tool library.
- Inspect already available STEP geometry and determine which recognized features have enough reliable evidence for assessment.
- Enumerate *supported operation + compatible tool + recognized feature* combinations, including alternatives; do not infer availability from theoretical machining knowledge.
- Produce a read-only, deterministic, explainable feasibility report.
- No DXF feature intent inference, LLM, autonomous operations, machining sequence, code generation, or new CAM strategy in 011-A.

## Guided user flow

1. User defines stock dimensions, placement/orientation and WCS context.
2. User selects material.
3. Advisor inspects the imported STEP/BRep data and records feature recognition confidence and gaps.
4. Advisor compares recognized features against installed tools and implemented strategy capabilities.
5. Advisor presents per-feature alternatives, evidence, limitations, and a non-binding overall coverage assessment.

## Candidate report model

Each recognized feature should carry:
- Stable source geometry references and geometry identity / analysis context.
- Feature kind and measurable geometry, plus explicit unknowns.
- Recognition evidence and confidence / unsupported reason.
- Candidate strategies with operation kind, tool ID, required geometric and tool conditions, existing capability source, and validation outcome.
- Status: DIRECTLY_COVERED, ALTERNATIVELY_COVERED, CONDITIONAL, NOT_COVERED, or UNKNOWN.
- Missing tools only when a capability-appropriate strategy genuinely requires them; do not imply purchasing a tool is the sole remedy.
- Human-readable explanation and unresolved checks.

Overall status is an aggregation of *recognized and assessed* features; unrecognized geometry must remain visible as UNKNOWN and prevent claims of complete coverage.

## Drill vs helical milling example

Given a STEP cylindrical feature of diameter 4 mm and a tool library containing a 3 mm end mill but no 4 mm drill:
- Axial drilling with a matching drill is unavailable.
- Helical milling is a **candidate** only if the existing operation/validator actually supports that geometry, tool, depth and entry mode.
- Pure geometric tool-center radius is (4 - 3) / 2 = 0.5 mm. This does not prove a valid helix, center clearance, cutting capability, reach, tool engagement, collision clearance or safe process.
- If required facts are missing or validation fails, report CONDITIONAL or NOT_COVERED with reasons, never DIRECTLY_COVERED.
- Never silently replace the user's intended strategy.

## Capability source of truth

Before implementing a matrix, audit current operation kinds, STEP/DXF restrictions, tool compatibility, selection requirements and validation interfaces. Prefer adapters derived from existing contracts over a parallel, independently maintained capability truth table. Unsupported combinations must fail closed.

## Report validity

Bind a report to geometry identity, setup/stock/orientation/WCS, material selection, tool-library snapshot and relevant operation-capability version. Changes to any dependency invalidate or require recomputation of affected findings. Material persistence and project reload behavior need explicit audit.

## Required 011-A audit questions

1. Which STEP features are discoverable automatically from current BRep data, and which currently require user selection?
2. Can each supported strategy be evaluated without mutating application stores or invoking production path generation?
3. What is the actual contract for STEP helical drilling, including feature references and tool compatibility?
4. Are canonical operation-kind mappings intentional for trochoidal operations?
5. Which existing validation results expose structured errors/warnings usable by a read-only advisor?
6. What tool dimensions and reach information are reliably available, and which are absent?
7. How is material context persisted and restored?

## Acceptance criteria for a later implementation

- Pure/deterministic analysis of immutable fixture inputs; no store mutation or kernel modifications.
- Tests for matching drill, valid helical alternative, invalid helix, missing tool, unrecognized STEP geometry, tool incompatibility, insufficient depth/reach information, and stale report invalidation.
- Explicit source/strategy capability gating; no fabricated feature recognition or unsupported machining suggestions.
- No NC output, no automatic operation creation, no bypass of preflight.
- Existing test/CI gates remain green; separate advisor tests document uncertainty and fail-closed behavior.

## Explicit non-goals

No autonomous CAM, no automatic fixture/setup planning, no guaranteed collision-free machining, no machine dynamics/rigidity prediction, no DXF machining-intent inference, no AI-generated NC, and no modifications to the production CAM kernel.
