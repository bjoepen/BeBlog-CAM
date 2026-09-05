# Build 004F — STEP Konturfräsen

## Ziel

004F verbindet die in 004B exportierte exakte STEP/BRep-Wire-Topologie mit dem kanonischen Konturwerkzeugweg.

`STEP BRep -> planare geschlossene Wire -> Radiuskorrektur -> Canonical Contour Toolpath -> Preflight -> Gesamtjob`

## Freigegeben

- geschlossene horizontale STEP-Wires
- Außen / Innen / Auf Linie
- Gleichlauf / Gegenlauf
- mehrere Zustellungen über `totalDepthMm` und `stepDownMm`
- operation-owned `stepWireId`
- deterministischer Fallback auf die größte obere geschlossene Wire, solange keine explizite Wire gewählt wurde
- Canonical Toolpath als gemeinsame Vorschau-/Preflight-/Job-Wahrheit

## Architektur

Es wird keine DXF-Geometrie synthetisiert. Die Kontur stammt aus `manufacturingWires` und `manufacturingEdges`. Linien und Kreis-/Bogenkanten werden aus ihren analytischen STEP-Daten abgetastet; die Werkzeugradiuskorrektur arbeitet anschließend auf der resultierenden geschlossenen Sollkontur.

## Fail closed

004F verweigert:

- offene STEP-Wires
- nicht horizontale Face-Wires
- X/Y-gekippte Aufspannungen
- nicht schließbare oder geometrisch nicht validierbare Wires
- fehlerhafte Werkzeugradiuskorrekturen

## Noch nicht Teil von 004F

- Durchfräsen relativ zur Rohlingunterseite / Overcut
- Haltestege
- explizite interaktive Wire-Auswahl im Viewport
- native G2/G3-Ausgabe für STEP-Bögen (004F darf konservativ segmentiert ausgeben)
- STEP-Taschen; diese folgen in 004G

## Lokale Gates

`pnpm check:004a && pnpm check:004b && pnpm check:004c && pnpm check:004d && pnpm check:004e && pnpm check:004f && pnpm check && pnpm build`

Kein nativer OCCT-Test erforderlich: 004F verändert die native Bridge nicht.
