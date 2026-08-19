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

## Gate 2 — Taschenoperation in der UX

Status: PASS

Die vorhandene linke Workflow-Leiste bleibt vollständig unverändert. Unter `04 · Bearbeiten` wird die Bearbeitungsart kontextuell gewählt:

`Kontur | Tasche`

Der Realtest bestätigte: Beim Wechsel von Kontur zu Tasche bleibt dieselbe CAD-Zielkontur erhalten und die Werkzeugbahn springt erwartungsgemäß in den Innenraum.

## Gate 3 — mathematischer Taschen-Preflight

Status: PASS

`05 · Prüfen` verarbeitet `ContourOperation` und `PocketOperation` über denselben sichtbaren Preflight-Schritt.

Der reale Rechteck-Testfall wurde erfolgreich als PASS bestätigt. Geprüft werden insbesondere:

- geschlossene Sollkontur,
- achsparallele Rechtecktasche,
- Werkzeugpassung,
- radiuskorrigierte Fräsermittelpunktfläche,
- Stepover und tatsächliche Rasterteilung,
- vollständige Rasterabdeckung,
- Wandumlauf,
- Z-Zustellungen,
- Schnittdaten,
- Sicherheits-Z,
- freigegebene Eintauchstrategie.

`Rampe` bleibt bewusst FAIL, bis ihre Geometrie in einem eigenen Gate erzeugt und geprüft wird.

## Gate 4 — Taschen-G-Code und `.nc`

Status: IMPLEMENTIERT / REALTEST AUSSTEHEND

Die in Gate 3 freigegebene Rechtecktaschen-Strategie wird nun in `06 · Fräsen` als Maschinenprogramm ausgegeben.

Verbindlicher Ablauf pro Z-Ebene:

1. Sicherheits-Z,
2. Anfahrt zum Startpunkt der Rasterbahn,
3. senkrechtes Eintauchen mit Eintauchvorschub,
4. deterministische Zickzack-Rasterräumung,
5. abschließender Wandumlauf auf der radiuskorrigierten Innenbegrenzung,
6. Rückzug auf Sicherheits-Z.

Mehrere Z-Zustellungen werden bis zur exakten Gesamttiefe erzeugt. Die letzte Zustellung wird gegebenenfalls kleiner als `stepDown` ausgeführt, damit die Solltiefe nicht überschritten wird.

Der G-Code verwendet für Gate 4 bewusst ausschließlich lineare Bewegungen (`G0/G1`). Die Herausforderung dieses Gates ist die vollständige Flächenräumung und Tiefenstrategie, nicht Bogeninterpolation.

### Export

Der bereits in 001G bewiesene `.nc`-Export wird auch für Taschen verwendet:

- Vorschau und gespeicherte Datei sind identisch,
- keine zweite G-Code-Berechnung beim Speichern,
- Standarddateiname erhält den Zusatz `-tasche.nc`,
- Rampenoperationen bleiben gesperrt.

Der Maschinen-Code wird in `src/lib/pocketGcode.ts` erzeugt; die UI liegt in `src/lib/PocketGCodePanel.svelte`.

### Gate-4-Realtest

Für PASS sind jetzt erforderlich:

- Rechtecktasche wählen,
- `05 · Prüfen` = PASS,
- `06 · Fräsen` erzeugt plausiblen Taschen-G-Code,
- `.nc` speichern,
- Datei in externem Viewer/Simulator laden,
- bestätigen, dass jede Z-Ebene vollständig geräumt und anschließend die Wand abgefahren wird.

Erst danach wird Gate 4 auf PASS gesetzt.
