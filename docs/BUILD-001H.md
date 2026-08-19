# BeBlog CAM — Build 001H

## Ziel

001H führt die erste echte Taschenoperation ein, ohne den in 001G bewiesenen Konturpfad zu verändern.

Produktregel:

**Die linke Workflow-Leiste bleibt unverändert. Tasche ist eine Bearbeitung innerhalb `04 · Bearbeiten`, kein neuer Hauptschritt.**

## Gate 1 — Taschenmodell und konservativer Geometriekern

Status: PASS / IMPLEMENTIERT

Für den ersten realen Taschenversuch wird absichtlich ein enger, sehr gut vermessbarer Referenzfall unterstützt:

- geschlossene achsparallele Rechtecktasche aus DXF,
- Schaftfräser mit bekanntem Durchmesser,
- definierte Gesamttiefe und Z-Zustellung,
- seitliche Zustellung als Prozent des Werkzeugdurchmessers,
- deterministische Rasterräumung,
- zusätzlicher Wand-Schlichtumlauf auf der radiuskorrigierten Innenkontur,
- zunächst konservative senkrechte Eintauchstrategie; Rampen werden als eigener Folge-Gate validiert.

Der pure Geometriekern liegt in `src/lib/pocketMath.ts`.

### Geometrische Regeln

Für eine rechteckige CAD-Tasche `[minX,maxX] × [minY,maxY]` wird die zulässige Fräsermittelpunktfläche um den Werkzeugradius nach innen reduziert:

`[minX+r,maxX-r] × [minY+r,maxY-r]`

Ein Werkzeug, das nicht vollständig in diese Fläche passt, führt zu FAIL.

Die Rasterbahnen werden so verteilt, dass der reale seitliche Abstand den eingestellten Stepover nicht überschreitet. Anschließend folgt ein geschlossener Cleanup-Umlauf entlang der Werkzeugmittelpunkt-Grenze, damit die Wandgeometrie nicht allein von den Rasterwendepunkten abhängt.

### Warum zunächst Rechtecktaschen?

Der erste physische Test soll nicht gleichzeitig Taschenstrategie, Offset-Topologie und komplexe Freiformgeometrie beweisen. Eine Rechtecktasche lässt sich nach dem Fräsen eindeutig vermessen: Breite, Länge, Tiefe, Wandmaß und Bodenbild.

Erst nach diesem physischen Nachweis wird die Taschengeometrie auf allgemeine geschlossene Konturen erweitert.

## Operation Model

`OperationKind` umfasst ab 001H:

- `contour`
- `pocket`

`PocketOperation` enthält zunächst Zielkontur, Werkzeug, Gleichlauf/Gegenlauf, Gesamttiefe, Z-Zustellung, Stepover in Prozent, Eintauchstrategie, vorbereiteten Rampenwinkel, Vorschub, Eintauchvorschub, Drehzahl und Sicherheits-Z.

Der Default-Stepover beträgt bewusst konservative 40 % des Werkzeugdurchmessers.

## Gate 2 — Taschenoperation in der UX

Status: IMPLEMENTIERT / REALTEST AUSSTEHEND

Die vorhandene linke Workflow-Leiste bleibt vollständig unverändert. Unter `04 · Bearbeiten` wird die Bearbeitungsart nun kontextuell gewählt:

`Kontur | Tasche`

Für `Kontur` bleibt der in 001G bewiesene Inspector erhalten. Für `Tasche` erscheinen ausschließlich taschenrelevante Parameter:

- Zielkontur,
- Werkzeugdurchmesser,
- seitliche Zustellung / Stepover,
- Eintauchstrategie `Senkrecht | Rampe`,
- Rampenwinkel nur bei gewählter Rampe,
- Gesamttiefe,
- Z-Zustellung,
- Vorschub,
- Eintauchvorschub,
- Drehzahl,
- Sicherheits-Z.

Die Konturauswahl im Viewport akzeptiert nun beide Operationstypen. Bei einer Tasche zeigt die rote Hilfslinie zunächst die um den Werkzeugradius reduzierte Innenbegrenzung; die vollständige Rasterräumung wird erst nach der Gate-3-Prüfung als freigegebene Werkzeugbahn visualisiert.

### Sicherheitsgrenze von Gate 2

Die Taschen-UX darf bereits vollständig bedienbar sein, aber `05 · Prüfen` und `06 · Fräsen` bleiben für `pocket` ausdrücklich gesperrt. Es gibt vor Gate 3 weder ein falsches PASS noch Taschen-G-Code.

Damit bleibt der 001G-Konturpfad unverändert nutzbar, während die neue Operation schrittweise und sichtbar entsteht.

## Gate 3 — als Nächstes

Gate 3 verbindet den Taschen-Geometriekern mit dem Preflight. Geprüft werden mindestens:

- geschlossene und für Gate 3 unterstützte Rechteckkontur,
- Werkzeug passt vollständig in die Tasche,
- Stepover liegt im freigegebenen Bereich,
- Rasterabdeckung ist vollständig,
- Wandumlauf liegt exakt um Werkzeugradius innerhalb der CAD-Sollwand,
- Z-Zustellungen erreichen die Gesamttiefe ohne Überschreitung,
- Eintauchstrategie ist für den aktuellen Gate-Stand freigegeben.

Erst nach diesem PASS darf `06 · Fräsen` Taschen-G-Code und `.nc` erzeugen.
