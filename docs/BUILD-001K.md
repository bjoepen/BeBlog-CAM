# BeBlog CAM — Build 001K

## Ziel

001K erweitert den bewiesenen klassischen 2D-CAM-Satz um **Bohren** als vierten Operationstyp neben Kontur, Tasche und Carve.

Gate 9 ist bewusst in zwei Schritte getrennt:

- **Gate 9A — Bohroperation und Geometrieauswahl**
- **Gate 9B — Maschinenpfad, vollständiger Preflight und konsistente G-Code-Kommentare**

## Gate 9A — Bohroperation und Geometrieauswahl

Status: **PASS / GESCHLOSSEN**

Der Realtest bestätigte:

- `Bohren` als vierter Operationstyp,
- native DXF-Kreise als Bohrreferenzen,
- Mittelpunkt des Kreises als Bohrachse,
- Einzelauswahl,
- Ebenen-Vorauswahl,
- nachträgliches Entfernen und Wiederhinzufügen einzelner Kreise,
- unabhängige Operationsdaten im Multi-Operation-Projekt.

**Gate 9A = PASS.**

## Gate 9B — Bohr-Maschinenpfad und vollständiger Preflight

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

### Maschinenstrategie

Gate 9B erzeugt bewusst portable, explizite Maschinenbewegungen statt controllerabhängiger Canned Cycles.

Grundablauf je Bohrposition:

1. Sicherheits-Z,
2. `G0` auf XY des DXF-Kreismittelpunkts,
3. `G1` auf die definierte Bohrtiefe mit Eintauchvorschub,
4. bei mehreren Z-Zustellungen kontrollierter Zwischenrückzug,
5. Rückzug auf Sicherheits-Z,
6. nächste Bohrposition.

Noch **nicht** Bestandteil von Gate 9B:

- `G81`, `G82`, `G83` oder andere controllerabhängige Canned Cycles,
- spezialisiertes Peck Drilling,
- Verweilzeit am Bohrungsgrund,
- Spiral-/Helix-Aufbohren,
- STEP-Bohrungserkennung.

### Reihenfolge

Mehrere Bohrpositionen werden per deterministischer Nächster-Nachbar-Reihenfolge angefahren. Diese Optimierung verändert ausschließlich die Reihenfolge der Safe-Z-XY-Fahrten; die CAD-Mittelpunkte selbst bleiben unverändert.

### Preflight

`05 · Prüfen` kontrolliert für Bohren jetzt:

- mindestens eine ausgewählte Bohrposition,
- ausschließlich native DXF-Kreise,
- Werkzeugdurchmesser > 0,
- Bohrtiefe > 0,
- Z-Zustellung > 0,
- Eintauchvorschub und Drehzahl > 0,
- Sicherheits-Z > 0,
- WCS Z = Oberseite,
- Hinweis bei fehlendem Rohling,
- Hinweis, wenn die Bohrtiefe die definierte Rohlingdicke überschreitet.

Ein echter Fehler setzt die Operation auf **FAIL** und blockiert den Export.

### Einzel- und Gesamtjob

`06 · Fräsen` besitzt einen eigenen Bohr-G-Code-Export als `.nc`.

Bohren ist außerdem in den projektweiten Preflight und den Multi-Operation-Gesamtjob integriert. Unterschiedliche Werkzeuge verwenden weiterhin den bewiesenen manuellen Werkzeugwechsel mit Safe-Z, `M5` und `M0`.

### Kommentar-Polish

Gate 9B beginnt die vereinbarte Konsolidierung der G-Code-Kommentare.

Verbindliches Schema:

- `Operation`
- `Strategie`
- `Werkzeug`
- relevante Bahn-/Eintauchmerkmale

Der aus Gate 8C offene veraltete Hinweis

`jeder Offset separat auf Safe-Z angefahren`

wird im tatsächlich exportierten Taschen-G-Code durch die korrekte Stay-Down-Semantik ersetzt. Die Normalisierung wird auch im Gesamtjob verwendet.

### Gate-9B-Realtest

Gate 9B ist PASS, wenn eine DXF mit mehreren ausgewählten Bohrkreisen bestätigt:

1. Einzel-Preflight PASS bzw. nur erwartete WARN-Hinweise,
2. `.nc` enthält exakt die ausgewählten Kreismittelpunkte,
3. keine XY-Rapidfahrt erfolgt unterhalb Sicherheits-Z zwischen Bohrpositionen,
4. Z-Tiefen entsprechen Gesamttiefe und Zustellung,
5. Safe-Z wird zwischen Bohrpositionen eingehalten,
6. CAMotics/NC Viewer zeigen alle gewünschten Bohrungen,
7. Multi-Operation-Job akzeptiert Bohren und erzeugt nötige Werkzeugwechsel,
8. bestehende Kontur-, Taschen- und Carve-Pfade bleiben regressionsfrei,
9. der Taschen-Header enthält keine veraltete 8B-Safe-Z-Aussage mehr.

## Danach

Nach Gate 9B kann **Peck Drilling** als eigenes Gate folgen. Zusätzlich bleiben spätere Erweiterungen wie DXF-POINT-Unterstützung, STEP-Bohrungserkennung und Helix-Aufbohren getrennte Themen.
