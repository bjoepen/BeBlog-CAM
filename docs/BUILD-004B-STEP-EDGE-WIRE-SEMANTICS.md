# Build 004B — STEP Edge / Wire Semantics

## Ziel

004B erweitert die in 004A eingeführte exakte STEP/BRep Manufacturing-Schicht um Kanten- und Wire-Topologie. Sie ist die Grundlage für spätere STEP-Konturen und Taschen.

## Vertrag

`STEP -> OCCT BRep -> Manufacturing Faces + Edges + Wires -> spätere Feature Recognition -> CAM Operation`

STEP bleibt BRep Source of Truth. `displayEdges` bleiben ausschließlich visuelle, gesampelte Geometrie.

### Manufacturing Edge

Jede eindeutige BRep-Kante erhält eine stabile `edgeId`, Kurventyp, Orientierung, exakten Start-/Endpunkt und Closed-Status. Kreisförmige Kanten liefern zusätzlich Mittelpunkt, Achse und Radius.

### Manufacturing Wire

Jeder Face-Wire erhält `wireId`, `faceId`, Orientierung, Closed-Status aus OCCT und die geordnet exportierten Referenzen auf globale `edgeId`s.

## Bewusst nicht Teil von 004B

- keine Konturklassifikation
- keine Pocket-/Island-Klassifikation
- keine Hole Recognition
- keine Werkzeugwege
- keine Pseudo-DXF-Konvertierung

## Gates

- `pnpm check`
- `pnpm build`
- `pnpm check:004a`
- `pnpm check:004b`
- OCCT Native CI

## Danach

004C kann zylindrische Faces, Kreis-Wires und Topologie konservativ zu echten Hole Features gruppieren. Die Edge/Wire-Schicht bleibt zugleich das Fundament für die spätere STEP-Konturbearbeitung.
