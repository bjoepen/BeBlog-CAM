# Build 011-D2 – explizite Zustellungsübernahme (Phase 1)

Ausgangspunkt: Main nach Merge PR #144 (`b53720da`). 011-D1 bietet
lesbare Advisory-Werte, aber bewusst keine Operationseingriffe.

## Phase 1 – sichere Übernahmeregel
`src/lib/engagementTransfer.ts` ist ein **reiner, nebenwirkungsfreier**
Adapter. Aufruf setzt eine ausdrückliche Auswahl von ap und/oder ae voraus.
Bei unzulässigen Kombinationen liefert er `unavailable` und verändert
kein Operation-Objekt.

- `ap` wird auf `stepDownMm` abgebildet, außer bei Pocket-Helix
  (dort Pitch/Umdrehung), Drill, Carve und Schlichten.
- `ae` kann bei Facing, Pocket, Z-Level und 3D-Roughing nur auf
  `stepoverPercent` abgebildet werden. **Spurabstand ist nicht
  tatsächliche Materialumschlingung.**
- Kontur und Trochoidal-Contour erhalten keine vermeintliche
  radiale Prozentübernahme.
- Werkzeugtyp und Wertgrenzen werden erneut geprüft.
- Keine Änderung von NC, Toolpath, Preflight, oder Fertigungsfreigaben.

## Phase 2 – nach Policy-PASS
Explizite UI-Checkboxen und Übernahme-Button; Ziel-Operation-ID,
Stale-Selection-Verhinderung, erneute Validierung im App-Handler,
Warnungen direkt bei »Bearbeiten«, keinerlei automatische Änderungen
bei bloßem Tabwechsel.

## Workflow
`node scripts/check-011d2-engagement-transfer.mjs`
`node scripts/check-011b-cutting-engagement.mjs`
`node scripts/check-011c-chip-thickness.mjs`
`pnpm check`
`pnpm build`

Nur Draft, kein Merge vor vollständiger UI-Integration und Tests.
