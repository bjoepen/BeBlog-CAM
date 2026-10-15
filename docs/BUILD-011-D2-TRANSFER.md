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

## Phase 2 – UI-Integration
Nach lokal gemeldetem Phase-1-PASS umgesetzt: zwei separate, standardmäßig
abgewählte Checkboxen sowie Übernahmebutton im Rechner. Der App-Handler
prüft die Ziel-Operations-ID und den vollständigen Operations-Snapshot und
berechnet die Empfehlung gegen das tatsächlich zugewiesene Werkzeug erneut.

Änderungen erscheinen nach bestätigter Übernahme an den bestehenden
Eingabefeldern unter »Bearbeiten«. Eine zusätzliche persistierte ae-Eigenschaft
wird bewusst **nicht** eingeführt. Maschinensteifigkeit bleibt eine
manuelle heuristische Einschätzung und ist kein Maschinenzertifikat.

UI-/CI-Abnahme ist noch offen; bei Helix, radial gesperrten Operationen,
Tool-Geometrie-Mismatch, nicht ausgewählten Checkboxen und stale target
jeweils Sperre ohne Mutation prüfen.

## Workflow
`node scripts/check-011d2-engagement-transfer.mjs`
`node scripts/check-011b-cutting-engagement.mjs`
`node scripts/check-011c-chip-thickness.mjs`
`pnpm check`
`pnpm build`

Nur Draft, kein Merge vor vollständiger UI-Integration und Tests.
