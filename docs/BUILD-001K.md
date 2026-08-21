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

Status: **PASS / GESCHLOSSEN**

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

Gate 9B konsolidiert die G-Code-Kommentare weiter.

Verbindliches Schema:

- `Operation`
- `Strategie`
- `Werkzeug`
- relevante Bahn-/Eintauchmerkmale

Der aus Gate 8C offene veraltete Hinweis

`jeder Offset separat auf Safe-Z angefahren`

wird im tatsächlich exportierten Taschen-G-Code durch die korrekte Stay-Down-Semantik ersetzt. Die Normalisierung wird auch im Gesamtjob verwendet.

### Gate-9B-Realtest

Der Realtest wurde mit einer DXF mit vier ausgewählten Bohrkreisen durchgeführt. Die exportierte `bohren-bohren.nc` wurde zusätzlich direkt geprüft und in CAMotics simuliert.

Bestätigt wurden:

- vier Bohrpositionen werden exakt an den DXF-Kreismittelpunkten angefahren,
- die getesteten Positionen liegen bei X/Y 10/10, 20/20, 30/30 und 40/40 mm,
- Gesamttiefe 3,000 mm bei maximaler Zustellung 1,000 mm wird als -1 / -2 / -3 mm ausgegeben,
- zwischen Bohrpositionen erfolgt der XY-Rapid ausschließlich nach Rückzug auf Sicherheits-Z 5,000 mm,
- innerhalb derselben Bohrung erfolgt zwischen den Zustellungen ein kontrollierter Rückzug auf Z0,000,
- keine Canned Cycles werden verwendet,
- Spindelstart, Safe-Z, M5 und M30 sind vollständig und eindeutig,
- CAMotics stellt alle gewünschten Bohrungen korrekt dar.

Die aktuelle Zwischenzustellungslogik mit Rückzug auf Z0,000 ist Bestandteil des bewiesenen 9B-Grundpfads. Ein späteres echtes Peck-Drilling-Gate darf diese Semantik gezielt erweitern oder ersetzen, aber nur mit eigenem Preflight und eigenem Realtest.

**Gate 9B = PASS.**

## Meilenstein 001K

BeBlog CAM besitzt nun den bewiesenen klassischen 2D-Operationssatz:

`Kontur · Tasche · Carve · Bohren`

Bohren ist dabei vollständig in Auswahl, Preflight, Einzel-Export und Multi-Operation-Gesamtjob integriert.

## Danach

Als nächstes kann **Peck Drilling** als eigenes Gate folgen. Zusätzlich bleiben spätere Erweiterungen wie DXF-POINT-Unterstützung, STEP-Bohrungserkennung und Helix-Aufbohren getrennte Themen.
