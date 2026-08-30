# 001Z-B — Canonical Toolpath → Prüfen

## Ziel

`Prüfen` darf keine eigene Werkzeugweg-Wahrheit besitzen.

`Operation → Canonical Toolpath → Bearbeiten / Prüfen → Postprozessor`

## Abdeckung

- Planen
- Kontur
- Tasche
- Carve
- Bohren
- Helixfräsen

## Invarianten

1. Eine gültige aktive Operation liefert genau einen kanonischen Toolpath.
2. `Prüfen` zeigt dessen reale Z-Ebenen.
3. Räumliche Pocket-Einstiege bleiben als kanonische Einstiegsbewegung sichtbar.
4. Bohren/Helix verwendet die native XYZ-Projektion aus 001Z-B.
5. Kontur/Tasche/Carve/Planen verwenden weiterhin den planaren 2.5D-Controller.
6. In `Prüfen` fällt der 2.5D-Controller auf `GeometryView` zurück, weil dort bewusst kein Bearbeiten-Auswahl-Overlay existiert.
7. Kein zweiter Preview- oder Postprozessorpfad wird eingeführt.

## Real-World Gate

Für jede Operation:

- Bearbeiten: Werkzeugbahn plausibel.
- Prüfen: dieselbe Werkzeugbahn sichtbar.
- 2.5D: Z-Ebenen stimmen mit Gesamttiefe/Zustellung überein.
- Fräsen: NC-Ausgabe entspricht der geprüften kanonischen Bahn.
- Kein visueller Sprung zwischen Bearbeiten und Prüfen.
