# Build 003E1 — Gesamtjob G-Code Release

`Fräsen` now exposes the already existing `generateJobGcode()` pipeline as the primary export.

The job generator remains responsible for operation order, safe-Z transitions, tool changes, M5/M0 and final M30. No machining geometry is added in this build.

## CBG Headstock gate

The reference job with two Z-Level operations and one 3D finishing operation must report 3 operations and 2 tool changes. The saved `-gesamtjob.nc` must contain `Bearbeitung 1/3`, `Bearbeitung 2/3`, `Bearbeitung 3/3`, two Werkzeugwechsel markers, and one final M30.
