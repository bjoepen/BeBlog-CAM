# Build 010-F12 — Canonical Preview Authority

F12 makes the DXF editing preview consume one machining truth.

- `App.svelte` continues to pass the active canonical toolpath directly to `GeometryView`.
- Trochoidal contour roughing therefore enters preview through the same production operation state used by F7-F10.
- When a canonical toolpath provides `motions`, those motions are authoritative for preview.
- Run and entry geometry is not rendered a second time beside authoritative motions.
- Canonical `rapid3`, `line3` and `arc3` motions remain the source for visible safe moves, ramps and cutting moves.
- Toolpaths without explicit motions keep the existing run/entry fallback.
- F12 changes no trochoid geometry, physical direction, depth, spoilboard or material-safety algorithm.
