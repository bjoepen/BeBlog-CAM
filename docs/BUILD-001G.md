# BeBlog CAM — Build 001G

## Ziel

Native Kreis- und Bogeninterpolation aus der ursprünglichen DXF-Geometrie erhalten, ohne aus bereits segmentierten G1-Punkten nachträglich Bögen zu erraten.

Verbindlicher Datenfluss:

`CAD-Geometrie → Werkzeugbahn mit erhaltener Linien-/Bogen-Semantik → G-Code`

## Gate 1 — native DXF-Kreise: PASS

**Datum:** 2026-08-18

Ein echter DXF-Kreis wird als analytische Werkzeugmittelbahn behandelt und nicht mehr als polygonale G1-Näherung ausgegeben.

Verifizierter Testfall:

- DXF-Kreis als eigene Kontur gewählt
- Werkzeug Ø 3.000 mm
- Innenbearbeitung
- Werkzeugbahn-Radius 2.100 mm
- vier Zustellungen bis Z -2.000 mm
- jeder Vollkreis wird controllerfreundlich in zwei 180°-Bögen zerlegt
- Gleichlauf/Gegenlauf bestimmt G2 bzw. G3
- Kreisbahn wird analytisch gegen den CAD-Kreis geprüft

Beispiel pro Zustellung:

```gcode
G1 Z-0.500 F200
G3 X87.900 Y13.330 I-2.100 J0.000 F600
G3 X92.100 Y13.330 I2.100 J0.000 F600
```

### Simulator-Verifikation

Der externe Simulator fährt pro Zustellung exakt zwei Halbkreise ab. Die zuvor sichtbare polygonale G1-Bewegung ist beim nativen Kreis verschwunden.

**Gate 1 = PASS.**

## Gate 2 — gemischte Konturen: PASS

**Datum:** 2026-08-18

Geschlossene Konturen aus echten DXF-Linien und DXF-Bögen werden als semantische Primitive durch die CAM-Kette geführt.

Regeln:

- Gerade → `G1`
- echter Kreisbogen → `G2/G3`
- keine nachträgliche Bogen-Erkennung aus G1-Punktwolken
- Linien und Bögen werden analytisch um den Werkzeugradius versetzt
- benachbarte Offset-Primitive werden geometrisch verbunden
- die resultierende gemischte Bahn wird im Preflight gegen die CAD-Sollkontur geprüft
- native Ausgabe erfolgt nur bei bestandener analytischer Prüfung
- bei nicht eindeutig freigabefähiger Geometrie bleibt die mathematisch geprüfte G1-Referenzbahn als sicherer Fallback bestehen

Unter `06 · Fräsen` wird der aktive Modus ausdrücklich angezeigt:

- `Native Kreisinterpolation`
- `Gemischte native Kontur · G1-Linien + G2/G3-Bögen`
- oder `G1-Referenzbahn`, wenn die native Semantik nicht sicher freigegeben werden kann.

### Reale Gate-2-Verifikation: Mini-OX-Seitenwange

Die bekannte Außenkontur der Mini-OX-Seitenwange wurde erfolgreich als gemischte native Werkzeugbahn erzeugt.

Verifizierter Testfall:

- Werkzeug Ø 5.000 mm
- Außenbearbeitung
- Werkzeugradius 2.500 mm
- drei Zustellungen bis Z -3.000 mm
- Vorschub 600 mm/min
- Eintauchvorschub 200 mm/min
- Drehzahl 12.000 1/min
- innerhalb jeder Zustellung: 5 lineare `G1`-Primitive + 5 native `G3`-Bögen
- identische XY-Geometrie in allen drei Zustellungen

Die zuvor aus rund 246 segmentierten Bahnprimitiven bestehende G1-Referenzdarstellung wird damit für diese Kontur durch eine kompakte native Linien-/Bogenbeschreibung ersetzt.

### Externe Viewer-/Simulator-Verifikation

Die erzeugte gemischte G1/G3-Bahn wurde in mehreren externen G-Code-Werkzeugen betrachtet. Die Werkzeuge interpretieren und visualisieren einzelne Kreisbögen unterschiedlich; ein Viewer stellte Teile der Bögen deutlich anders dar. In CutViewer wird die Mini-OX-Außenkontur dagegen geschlossen und geometrisch plausibel dargestellt, einschließlich der kritischen Line↔Arc-Übergänge.

Diese Beobachtung begründet eine verbindliche Validierungsregel:

**Externe Simulatoren und Viewer sind Validierungshilfen, aber keine geometrische Wahrheitsquelle.**

Maßgeblich bleiben die CAD-Sollkontur und die mathematisch geprüfte CAM-Werkzeugbahn. Ein externer Simulator darf auf mögliche Probleme aufmerksam machen und gehört zum Realitätscheck, entscheidet aber nicht allein über die geometrische Richtigkeit einer Werkzeugbahn.

Der Safety-Fallback bleibt unverändert: Kann die native Offset-Geometrie nicht eindeutig geschlossen und geprüft werden, wird keine halbfertige G2/G3-Bahn ausgegeben, sondern auf die bereits verifizierte G1-Referenzbahn zurückgefallen.

**Gate 2 = PASS.**

## Abschlussgate — `.nc`-Dateiexport: IMPLEMENTIERT / REALTEST AUSSTEHEND

`06 · Fräsen` kann den bereits erzeugten und geprüften G-Code nun direkt als `.nc`-Datei speichern.

Verbindliche Exportregeln:

- Standardformat ist `.nc`.
- Der Speichern-Dialog schlägt den Bauteilnamen mit `.nc` vor.
- Fehlt die Dateiendung, ergänzt BeBlog CAM `.nc` automatisch.
- Der native Backend-Befehl akzeptiert in 001G ausschließlich `.nc`.
- Exportiert wird exakt der String, der gleichzeitig in der G-Code-Vorschau angezeigt wird.
- Es findet beim Speichern keine zweite G-Code-Generierung, keine Neuformatierung und keine versteckte Postprozessor-Transformation statt.
- Der Export steht nur zur Verfügung, wenn die aktuelle G-Code-Erzeugung erfolgreich ist.

Damit kann die tatsächlich von BeBlog CAM erzeugte Maschinenprogrammdatei unmittelbar in externen Viewern/Simulatoren geprüft und anschließend als identische Datei zur Codekontrolle weitergegeben werden.

Das Abschlussgate wird nach einem real gespeicherten, erneut geöffneten und in einem externen Viewer geprüften `.nc`-File auf PASS gesetzt.

## Regression vor 001G Final

Vor dem Einfrieren von 001G werden die bereits bewiesenen Referenzfälle nochmals kontrolliert:

1. nativer DXF-Kreis — G2/G3, zwei Halbkreise pro Zustellung;
2. einfacher gemischter Testkörper — G1 + G2/G3;
3. Mini-OX-Außenkontur — analytisch geprüfte gemischte native Bahn;
4. Außen/Innen — Werkzeugradius liegt auf der korrekten Seite;
5. Gleichlauf/Gegenlauf — Fahrtrichtung und G2/G3-Richtung wechseln konsistent;
6. `.nc`-Export — gespeicherter Dateiinhalt entspricht exakt der Vorschau.

## Ergebnis 001G bis Gate 2

BeBlog CAM beherrscht nun sowohl native Vollkreise als auch reale zusammengesetzte DXF-Konturen aus Linien und Kreisbögen. Die ursprüngliche CAD-Semantik bleibt durch die Werkzeugbahnberechnung bis in den G-Code erhalten.

Damit gilt weiterhin:

`CAD-Geometrie → analytische Werkzeugbahn → mathematische Prüfung → native G1/G2/G3-Ausgabe`

und ausdrücklich nicht:

`CAD → segmentierte Punktwolke → nachträgliches Arc-Fitting`
