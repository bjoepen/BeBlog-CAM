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

## Gate 2 — gemischte Konturen

Als nächster Schritt werden geschlossene Konturen aus echten DXF-Linien und DXF-Bögen semantisch erhalten:

- Gerade → `G1`
- echter Kreisbogen → `G2/G3`
- keine nachträgliche Bogen-Erkennung aus G1-Punktwolken
- native Ausgabe nur, wenn die analytisch radiuskorrigierten Primitive kontinuierlich und geometrisch konsistent verbunden werden können
- bei nicht eindeutig unterstützbarer Geometrie bleibt die mathematisch geprüfte G1-Referenzbahn als sicherer Fallback bestehen
