# BeBlog CAM — Build 001G

## Status

**001G FINAL — PASS**  
**Finalisiert:** 2026-08-19

## Ziel

Native Kreis- und Bogeninterpolation aus der ursprünglichen DXF-Geometrie erhalten, ohne aus bereits segmentierten G1-Punkten nachträglich Bögen zu erraten.

Verbindlicher Datenfluss:

`CAD-Geometrie → Werkzeugbahn mit erhaltener Linien-/Bogen-Semantik → G-Code`

## Gate 1 — native DXF-Kreise: PASS

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

### Reale Gate-2-Verifikation: Mini-OX-Seitenwange

Die bekannte Außenkontur der Mini-OX-Seitenwange wurde erfolgreich als gemischte native Werkzeugbahn erzeugt. Geraden werden als `G1`, echte Bögen als native `G2/G3` ausgegeben. Die identische XY-Geometrie wird über alle Zustellungen wiederverwendet.

### Externe Viewer-/Simulator-Verifikation

Die erzeugte gemischte Bahn wurde in mehreren externen Werkzeugen betrachtet. Unterschiedliche Viewer können Kreisinterpolation unterschiedlich visualisieren. Daraus gilt verbindlich:

**Externe Simulatoren und Viewer sind Validierungshilfen, aber keine geometrische Wahrheitsquelle.**

Maßgeblich bleiben die CAD-Sollkontur und die mathematisch geprüfte CAM-Werkzeugbahn.

**Gate 2 = PASS.**

## Gate 3 — `.nc`-Export und Regression: PASS

`06 · Fräsen` speichert den bereits erzeugten und geprüften G-Code direkt als `.nc`-Datei.

Verbindliche Exportregeln:

- Standardformat ist `.nc`.
- Der Speichern-Dialog schlägt den Bauteilnamen mit `.nc` vor.
- Fehlt die Dateiendung, ergänzt BeBlog CAM `.nc` automatisch.
- Der native Backend-Befehl akzeptiert in 001G ausschließlich `.nc`.
- Exportiert wird exakt der String aus der G-Code-Vorschau.
- Beim Speichern findet keine zweite G-Code-Generierung, Neuformatierung oder versteckte Transformation statt.
- Export ist nur nach erfolgreicher G-Code-Erzeugung verfügbar.

### Reale Export-Regression

Mehrere von BeBlog CAM selbst geschriebene `.nc`-Dateien wurden anschließend als die tatsächlichen Exportartefakte kontrolliert.

#### Außen / Innen

Für dieselbe Mini-OX-Sollkontur mit Werkzeug Ø 3.000 mm wurden Außen- und Innenbearbeitung exportiert. Der Werkzeugradius beträgt 1.500 mm. Die Werkzeugmittelbahnen liegen erwartungsgemäß auf gegenüberliegenden Seiten der Sollkontur; der Abstand korrespondierender Außen-/Innenbahnen beträgt damit 3.000 mm. Zustellungen und Schnittdaten bleiben konsistent.

Damit ist nachgewiesen, dass Außen/Innen nicht unterschiedliche Sollgeometrien erzeugen, sondern dieselbe CAD-Kontur korrekt um den Werkzeugradius auf der gewählten Seite versetzen.

#### Gleichlauf / Gegenlauf

Für dieselbe Außenkontur wurden zusätzlich reale `.nc`-Exporte für Gleichlauf und Gegenlauf kontrolliert. Die Werkzeugmittelbahn bleibt geometrisch identisch, wird jedoch in entgegengesetzter Richtung durchlaufen. Die native Bogenrichtung wechselt entsprechend konsistent zwischen `G2` und `G3`.

Damit ist die Richtungsumkehr als reine Fahrtrichtungsänderung bestätigt; sie verändert weder Sollkontur noch Werkzeugradiuskorrektur.

### Finaler Regressionsstand

- nativer DXF-Kreis — PASS
- einfacher gemischter LINE/ARC-Testkörper — PASS
- Mini-OX-Außenkontur — PASS
- Außen/Innen — PASS
- Gleichlauf/Gegenlauf — PASS
- mathematischer Preflight — PASS
- sicherer G1-Fallback bei nicht freigabefähiger nativer Semantik — PASS
- `.nc`-Export der tatsächlich angezeigten G-Code-Version — PASS
- externe Viewer-/Simulator-Plausibilisierung — PASS

**Gate 3 = PASS.**

## 001G Final

BeBlog CAM beherrscht mit 001G native Vollkreise und reale zusammengesetzte DXF-Konturen aus Linien und Kreisbögen. Die ursprüngliche CAD-Semantik bleibt durch Radiuskorrektur, Preflight und G-Code-Erzeugung erhalten. Innen/Außen und Gleichlauf/Gegenlauf sind als unabhängige geometrische bzw. fahrstrategische Entscheidungen regressionsgeprüft. Der geprüfte Maschinen-Code kann als `.nc` gespeichert und als identisches Artefakt extern weiterverwendet werden.

Verbindlich bleibt:

`CAD-Sollgeometrie → analytische Werkzeugbahn → mathematische Prüfung → native G1/G2/G3-Ausgabe → .nc`

und ausdrücklich nicht:

`CAD → segmentierte Punktwolke → nachträgliches Arc-Fitting`

**001G ist eingefroren. Neue CAM-Funktionen gehören in den Folgebuild.**
