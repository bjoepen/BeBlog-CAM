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

Status: IMPLEMENTIERT / REALTEST AUSSTEHEND

`05 · Prüfen` verarbeitet nun `ContourOperation` und `PocketOperation` über denselben sichtbaren Preflight-Schritt.

Für eine Tasche werden geprüft:

- geschlossene Sollkontur vorhanden,
- Gate-3-Geometrie ist eine achsparallele Rechtecktasche,
- Werkzeugdurchmesser > 0,
- Werkzeug passt vollständig in die Tasche,
- CAD-Wand bleibt geometrische Wahrheit,
- Fräsermittelpunktfläche liegt um den Werkzeugradius vollständig innerhalb der CAD-Wand,
- Stepover liegt > 0 % und ≤ 100 %,
- reale Rasterteilung überschreitet den eingestellten maximalen Stepover nicht,
- Anzahl der Rasterbahnen wird explizit ausgewiesen,
- abschließender Wandumlauf liegt auf der radiuskorrigierten Innenbegrenzung,
- Gesamttiefe und Z-Zustellung sind plausibel,
- Vorschub, Eintauchvorschub und Drehzahl sind > 0,
- Sicherheits-Z ist > 0,
- in Gate 3 ist ausschließlich senkrechtes Eintauchen freigegeben.

Wird `Rampe` gewählt, erzeugt der Preflight bewusst FAIL. Der Parameter ist sichtbar vorbereitet, aber die Rampengeometrie wird erst in einem eigenen Gate erzeugt und validiert.

### Sicherheitsgrenze von Gate 3

`06 · Fräsen` bleibt für `PocketOperation` weiterhin gesperrt. Ein PASS im Taschen-Preflight bedeutet zunächst nur: Die definierte Taschenstrategie ist mathematisch konsistent und freigabefähig für die nächste Entwicklungsstufe.

Es wird noch kein Taschen-G-Code erzeugt.

## Gate 4 — als Nächstes

Nach erfolgreichem Realtest von Gate 3 wird exakt die geprüfte Raster- und Cleanup-Bahn in Maschinenbewegungen überführt:

- sichere Anfahrt,
- senkrechtes Eintauchen mit Eintauchvorschub,
- Rasterräumung pro Z-Zustellung,
- Wandumlauf pro Z-Ebene,
- Rückzug auf Sicherheits-Z,
- `.nc`-Export über denselben in 001G bewiesenen Exportpfad.

Für Gate 4 gilt erneut: **Die erzeugte G-Code-Bahn muss dieselbe Geometrie sein, die Gate 3 geprüft hat. Keine zweite unabhängige Taschenberechnung im Export.**
