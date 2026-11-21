# Development 011-G2 — STEP Feature Classification and Uncertainty

## Contract

011-G2 is a stateless, deterministic classification layer over the version 1 STEP manufacturing feature inventory. The inventory remains the sole geometric authority. Classification preserves its orientation, feature IDs, measurements and native BRep references and does not read filenames, display meshes, application stores or production path generators.

Each classified feature exposes:

- `geometryKind` and qualitative `recognitionStatus` (`recognized`, `candidate`, `unresolved` or `unsupported`);
- qualitative geometric `confidence`, deliberately separate from Advisor feasibility coverage;
- source-backed verified evidence and native references;
- zero or more `plausible-unproven` manufacturing interpretations;
- structured unknowns and the evidence required before any interpretation could be adopted;
- explicit limitations inherited from G1.

No percentage confidence is invented. Unknown intent, setup access, collision clearance, material-removal side, entry suitability, termination and explicit selection remain unknown until supplied by an authoritative later workflow.

## Feature behavior

- Recognized holes retain diameter, depth, axis and recognition-specific circular evidence. Blind/through termination, access and tool suitability remain unknown.
- Rejected cylindrical faces retain cylindrical topology and are never promoted back into holes.
- Planar faces may have several mutually compatible plausible interpretations—such as facing, pocket floor or preserved reference surface—but none is selected.
- Open and closed contour wires retain verified topology. Inside/outside/on-line intent remains unresolved and explicit selection remains required.
- Complete horizontal planar regions retain area and island evidence. Pocket and planar-clearing interpretations remain non-binding; depth, entry and accessibility are unknown.
- Unsupported or incomplete boundaries retain their G1 resolution reason and native references and receive no positive manufacturing interpretation.

## Validation and lifecycle

`classifyStepManufacturingFeatures()` validates inventory version, orientation, stable identity, deterministic native references, geometric evidence and kind-specific measurements. Invalid or incomplete evidence fails closed with no partial classification. Results are not persisted in 011-G2, so no additional identity mechanism is introduced. Any future persistence must use the existing verified Advisor geometry/context identity and invalidation contract.

The classifier does not import Advisor feasibility, operations, tool selection, preflight, simulation, toolpaths or NC generation. Existing `DIRECT`, `ALTERNATIVE`, `CONDITIONAL` and `NOT_COVERED` statuses are not geometric confidence labels and are absent from this contract.

## Verification

Run `pnpm check:011g2`. The focused gate covers every G1 feature kind, explicit uncertainty, multiple plausible interpretations without automatic choice, invalid evidence, deterministic ordering, source-reference stability, immutability, Advisor separation and absence of production outputs. Existing G1, Advisor and production regression gates remain authoritative for their respective boundaries.
