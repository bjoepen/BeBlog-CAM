# BeBlog CAM — Build 001H

## Ziel

001H führt die erste echte Taschenoperation ein, ohne den in 001G bewiesenen Konturpfad zu verändern.

Produktregel:

**Die linke Workflow-Leiste bleibt unverändert. Tasche ist eine Bearbeitung innerhalb `04 · Bearbeiten`, kein neuer Hauptschritt.**

## Gate 1 — Taschenmodell und konservativer Geometriekern

Status: IMPLEMENTIERT / UI- UND G-CODE-VERDRAHTUNG FOLGT

Für den ersten realen Taschenversuch wird absichtlich ein enger, sehr gut vermessbarer Referenzfall unterstützt:

- geschlossene achsparallele Rechtecktasche aus DXF,
- Schaftfräser mit bekanntem Durchmesser,
- definierte Gesamttiefe und Z-Zustellung,
- seitliche Zustellung als Prozent des Werkzeugdurchmessers,
- deterministische Rasterräumung,
- zusätzlicher Wand-Schlichtumlauf auf der radiuskorrigierten Innenkontur,
- zunächst konservative senkrechte Eintauchstrategie; Rampen werden als eigener Folge-Gate validiert.

Der neue pure Geometriekern liegt in `src/lib/pocketMath.ts`.

### Geometrische Regeln

Für eine rechteckige CAD-Tasche `[minX,maxX] × [minY,maxY]` wird die zulässige Fräsermittelpunktfläche um den Werkzeugradius nach innen reduziert:

`[minX+r,maxX-r] × [minY+r,maxY-r]`

Ein Werkzeug, das nicht vollständig in diese Fläche passt, führt zu FAIL.

Die Rasterbahnen werden so verteilt, dass der reale seitliche Abstand den eingestellten Stepover nicht überschreitet. Anschließend folgt ein geschlossener Cleanup-Umlauf entlang der Werkzeugmittelpunkt-Grenze, damit die Wandgeometrie nicht allein von den Rasterwendepunkten abhängt.

### Warum zunächst Rechtecktaschen?

Der erste physische Test soll nicht gleichzeitig Taschenstrategie, Offset-Topologie und komplexe Freiformgeometrie beweisen. Eine Rechtecktasche lässt sich nach dem Fräsen eindeutig vermessen:

- Breite,
- Länge,
- Tiefe,
- Wandmaß,
- Bodenbild.

Erst nach diesem physischen Nachweis wird die Taschengeometrie auf allgemeine geschlossene Konturen erweitert.

## Operation Model

`OperationKind` umfasst ab 001H:

- `contour`
- `pocket`

`PocketOperation` enthält zunächst:

- Zielkontur,
- Werkzeug,
- Gleichlauf/Gegenlauf,
- Gesamttiefe,
- Z-Zustellung,
- Stepover in Prozent,
- Eintauchstrategie,
- Rampenwinkel als vorbereiteten Folgeparameter,
- Vorschub,
- Eintauchvorschub,
- Drehzahl,
- Sicherheits-Z.

Der Default-Stepover beträgt bewusst konservative 40 % des Werkzeugdurchmessers.

## Nächstes Gate

Gate 2 verdrahtet die Taschenoperation in die bestehende UX:

`04 · Bearbeiten → Tasche → Kontur wählen → Parameter`

`05 · Prüfen` muss anschließend Werkzeugpassung, Stepover, Z-Zustellungen und vollständige Flächenabdeckung prüfen.

Erst wenn Gate 2 PASS ist, darf `06 · Fräsen` Taschen-G-Code und `.nc` erzeugen.
