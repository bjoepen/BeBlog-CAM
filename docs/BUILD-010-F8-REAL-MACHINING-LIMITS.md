# Build 010-F8 — Real Machining Limits

F8 separates trochoidal operation depth from physical stock boundaries before F6 is allowed to build cutting geometry.

- Manual depth remains an explicit operation depth and cannot silently carry overcut.
- Stock-bottom mode resolves the real target as stock thickness plus explicit overcut.
- Workpiece bottom and overcut remain separate values; the target is not treated as a generic negative-Z number.
- Stock-bottom mode requires defined stock, top-Z WCS and a positive stock thickness.
- Cutter cutting length must reach the complete resolved target depth including overcut.
- Invalid combinations fail closed before canonical toolpath generation.
- F6 remains the sole trochoidal cutting-geometry authority and receives only the resolved target depth.

F8 does not model the spoilboard thickness or machine bed yet. It establishes the boundary needed for a later setup-level spoilboard/fixture clearance contract without conflating it with workpiece depth.
