# BeBlog CAM — Build 001K

## Ziel

001K erweitert den bewiesenen klassischen 2D-CAM-Satz um **Bohren** als vierten Operationstyp neben Kontur, Tasche und Carve.

Die bewiesenen Maschinenpfade aus 001H–001J bleiben unverändert. Gate 9 wird bewusst in zwei Schritte getrennt:

- **Gate 9A — Bohroperation und Geometrieauswahl**
- **Gate 9B — Maschinenpfad, vollständiger Preflight und konsistente G-Code-Kommentare**

## Gate 9A — Bohroperation und Geometrieauswahl

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

### Operationsmodell

`OperationKind` enthält nun:

`contour | pocket | carve | drill`

`DrillOperation` besitzt im ersten Gate:

- eigene stabile Operations-ID,
- eigenen Namen,
- eigenes Werkzeug,
- Tiefe und Schnittdaten als vorbereitete Operationsdaten,
- `curveIds` für die konkrete Geometrieauswahl,
- `selectionMode: individual | layer`,
- optionale `layerName` als Vorauswahl.

Damit bleibt Bohren im Multi-Operation-Projekt genauso unabhängig editierbar wie Kontur, Tasche und Carve.

### Geometrische Wahrheit in 9A

Gate 9A verwendet zunächst ausschließlich **native DXF-Kreise** als Bohrreferenzen.

Verbindliche Semantik:

**Der Mittelpunkt des CAD-Kreises definiert die spätere Bohrachse.**

Der Kreis selbst bleibt Referenzgeometrie und wird in 9A noch nicht in einen Werkzeugweg umgewandelt.

Nicht unterstützt in 9A:

- beliebige geschlossene Polylinien als Bohrung,
- STEP-Bohrungserkennung,
- DXF-POINT-Entitäten,
- Kreisinterpolation zum Aufbohren,
- Peck Drilling.

Diese Fälle benötigen getrennte spätere Gates.

### Auswahl-UX

Unter `04 · Bearbeiten` steht nun als vierter Typ **Bohren** zur Verfügung.

Bohrungen können gewählt werden über:

1. **Einzeln** — native DXF-Kreise direkt im Viewport anklicken.
2. **Ebene** — alle nativen Kreise einer DXF-Ebene als Vorauswahl übernehmen.

Wie bei Carve gilt verbindlich:

**Eine Ebenenauswahl ist nur eine Vorauswahl.**

Einzelne automatisch ausgewählte Kreise können anschließend wieder entfernt oder erneut hinzugefügt werden. Dadurch kann beispielsweise eine Ebene `HOLES` genutzt werden, ohne dass jede darin enthaltene Kreisgeometrie zwingend gebohrt werden muss.

### Viewport

Im Bohrmodus werden native Kreise als Bohrkandidaten dargestellt. Der Mittelpunkt wird zusätzlich als Kreuz markiert. Ausgewählte Bohrungen erhalten die aktive Bearbeitungsmarkierung.

### Preflight 9A

`05 · Prüfen` besitzt für eine einzelne Bohroperation einen eigenen Gate-9A-Preflight.

Geprüft werden zunächst nur:

- mindestens eine Bohrposition ausgewählt,
- jede ausgewählte Geometrie ist tatsächlich ein nativer DXF-Kreis,
- Anzahl der Bohrpositionen,
- Auswahlmodus bzw. Ebene.

Der Status heißt bewusst **AUSWAHL PASS/FAIL** und ist noch keine Maschinenfreigabe.

### Sicherheitsgrenze

Gate 9A erzeugt **keinen Bohr-G-Code**.

`06 · Fräsen` weist ausdrücklich darauf hin, dass der Maschinenpfad bis Gate 9B gesperrt ist. Enthält ein Multi-Operation-Gesamtjob bereits eine Bohroperation, bleibt auch dieser Gesamtjob bis 9B auf FAIL.

Damit kann das neue Operationsmodell getestet werden, ohne eine noch nicht bewiesene Bohrbewegung versehentlich freizugeben.

### Gate-9A-Realtest

Gate 9A wird PASS, wenn eine DXF mit mehreren nativen Kreisen folgendes bestätigt:

1. `Bohren` lässt sich als neue Bearbeitung hinzufügen.
2. Mehrere Kreise lassen sich einzeln auswählen.
3. Ein ausgewählter Kreis lässt sich wieder entfernen.
4. Ebenen-Vorauswahl wählt ausschließlich native Kreise dieser Ebene.
5. Nach Ebenen-Vorauswahl lassen sich einzelne Kreise wieder abwählen und erneut hinzufügen.
6. Die Bearbeitungsliste zeigt Anzahl der Bohrungen und Auswahlquelle korrekt.
7. `05 · Prüfen` meldet für eine gültige Auswahl `AUSWAHL PASS`.
8. Ohne Auswahl meldet der Preflight `AUSWAHL FAIL`.
9. `06 · Fräsen` erzeugt bewusst noch keine `.nc`-Datei.
10. Bestehende Kontur-, Taschen- und Carve-Operationen bleiben regressionsfrei.

## Gate 9B — danach

9B ergänzt anschließend:

- portable explizite G0/G1-Bohrbewegungen statt controllerabhängiger Canned Cycles,
- vollständigen Preflight für Tiefe, Werkzeug, WCS und Sicherheits-Z,
- Reihenfolge/Travel-Optimierung mehrerer Bohrungen,
- Einbindung in Gesamtjob und Werkzeugwechsel,
- konsistente G-Code-Kommentare über Kontur, Tasche, Carve und Bohren,
- dabei auch den aus Gate 8C offenen Kommentar-Polish für Safe Stay-Down.

Peck Drilling bleibt danach eine getrennte Erweiterung.
