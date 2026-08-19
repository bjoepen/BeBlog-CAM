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

Status: **PASS / GESCHLOSSEN**  
Geschlossen: **2026-08-19**

Die in Gate 3 freigegebene Rechtecktaschen-Strategie wird in `06 · Fräsen` als Maschinenprogramm ausgegeben.

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

Die von BeBlog CAM erzeugte `.nc` wurde in CAMotics simuliert. Die Simulation bestätigt:

- vollständige Rasterräumung über alle vorgesehenen Z-Ebenen,
- korrekte Zustellfolge,
- anschließenden Wandumlauf auf jeder Ebene,
- plausiblen Rückzug auf Sicherheits-Z,
- geometrisch erwartete fertige Rechtecktasche.

**Gate 4 = PASS.**

### Gate-4-Polish — Übergang Raster → Wandumlauf

Im ersten PASS-Code begann der geschlossene Wandumlauf immer an seinem statischen ersten Eckpunkt. Endete die Rasterräumung an einer anderen Ecke, fuhr der Fräser deshalb unnötig diagonal durch die bereits ausgeräumte Tasche zurück.

Der Cleanup-Pfad wird nun zyklisch auf den geometrisch nächstgelegenen gültigen Startpunkt rotiert. Da der Wandumlauf geschlossen ist, verändern sich dadurch weder Geometrie noch Umlaufrichtung.

Für den Referenzfall endet die Rasterbahn bereits auf einer Ecke des Wandumlaufs. In diesem Fall entfällt der Positionierzug vollständig und der Wandumlauf setzt direkt von der aktuellen Fräserposition fort.

Der korrigierte Export wurde erneut in CAMotics geprüft. Der Wandumlauf beginnt nun unmittelbar an der erreichten Raster-Endposition; die zuvor sichtbare unnötige Diagonalfahrt ist entfallen.

Verbindliche Toolpath-Regel daraus:

**Geschlossene Folgepfade sollen am bereits erreichten oder geometrisch nächstgelegenen gültigen Startpunkt beginnen, sofern Geometrie und Bearbeitungsrichtung dadurch unverändert bleiben.**

Dieser Polish verändert keine Sollmaße und keine geprüfte Taschengeometrie; er reduziert ausschließlich unnötige Verfahrwege.

### Nicht Bestandteil von Gate 4

Eine allgemeine End-of-Job-/Parkstrategie wird bewusst nicht mehr in Gate 4 aufgenommen. Das spätere Verhalten nach Abschluss der letzten Bearbeitung — etwa Sicherheits-Z, Rückkehr zu einer definierten Start-/Parkposition und Spindelstopp — ist eine job- bzw. postprozessorweite Funktion und wird in einem späteren Build spezifiziert.

## Gate-4-Abschluss

Gate 4 ist nach mathematischem Preflight, `.nc`-Export, CAMotics-Simulation und bestätigtem Toolpath-Polish **geschlossen**.

Der funktionierende Taschenpfad wird für die nächsten Entwicklungsschritte als Referenz geschützt:

`DXF-Sollkontur → radiuskorrigierte Taschenfläche → Rasterstrategie → Preflight → Z-Zustellungen → Wandumlauf → .nc → CAMotics`

Neue Funktionen verändern diesen bewiesenen Gate-4-Pfad nicht ohne eigenes Regression-Gate.
