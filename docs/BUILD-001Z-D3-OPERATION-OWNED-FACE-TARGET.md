# 001Z-D3 — Operation-owned Face Target

`ZLevelRoughingOperation` besitzt jetzt die ausgewählten STEP/BRep `faceIds`.

Damit gehört die geometrische Zielauswahl derselben Bearbeitung wie:

- Werkzeug
- Schnittdaten
- Zustellung
- Stepover
- Schlichtaufmaß
- Safe-Z

`GeometryView` ist für die Face-Auswahl nur noch Editor/Renderer. Änderungen werden an `App` publiziert und in der aktiven Z-Level-Operation gespeichert.

## Konsequenz

Beim Wechsel zwischen mehreren Z-Level-Schruppoperationen besitzt jede Operation ihre eigene Zielfläche. Der Viewport zeigt jeweils die Auswahl der aktiven Operation.

## Noch offen

Der erzeugte Canonical Face-Target Toolpath wird weiterhin aus der operation-owned Auswahl im Viewport aufgebaut und an den Host publiziert. Der nächste Schritt kann dadurch den Gesamtjob/Export ohne View-State-Sonderfall aufbauen.
