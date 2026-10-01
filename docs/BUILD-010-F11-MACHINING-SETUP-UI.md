# Build 010-F11 — Machining Setup & Trochoid UI

F11 exposes the existing F8-F10 machining authorities in the normal application workflow without adding a second machining state.

- Rohling setup exposes the persisted `spoilboardThicknessMm` value.
- The same spoilboard value continues to flow into project save/load and job preflight.
- Trochoidal contour roughing gets an explicit Bearbeiten inspector.
- A DXF contour click selects the single authoritative `operation.contourId`.
- Side and climb/conventional direction edit the existing operation consumed by F10.
- Trochoid radius, forward step, ramp angle, manual/stock-bottom depth, overcut, stepdown and radial/axial allowances edit the existing operation consumed by F8-F10.
- Switching back to manual depth clears overcut to preserve the F8 manual-depth contract.
- No canonical, protected-envelope, material-exposure, spoilboard or physical-direction algorithm is changed by F11.
