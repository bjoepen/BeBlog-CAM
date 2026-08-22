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

# Meilenstein 001K — Klassischer 2D-CAM-Kern

Status: **PASS / DOKUMENTIERT / FREIGEGEBEN**

Mit Build 001K erreicht BeBlog CAM erstmals einen vollständigen, praktisch geprüften klassischen 2D-Operationssatz:

**Kontur · Tasche · Carve · Bohren**

Der Meilenstein beschreibt nicht nur das Vorhandensein der vier Operationstypen. Alle vier sind Bestandteil desselben linearen CAM-Workflows und wurden über die bisherigen Gates schrittweise mit Preflight, G-Code-Ausgabe und externer Simulation abgesichert.

## Bewiesener Funktionsumfang

### Kontur

- geschlossene DXF-Konturen,
- Innen-, Außen- und Auf-Linie-Bearbeitung,
- Werkzeugradiuskorrektur auf Basis der CAD-Geometrie,
- Gleichlauf/Gegenlauf,
- native Kreis- und Bogensemantik dort, wo sie geometrisch vorliegt,
- mehrere Tiefenzustellungen,
- Safe-Z-Logik und `.nc`-Export.

### Tasche

- Rechtecktaschen mit Rasterräumung,
- Kreistaschen mit konzentrischer analytischer Räumung,
- gemischte LINE/ARC-Konturen mit konturparallelen Innenoffsets,
- native `G1`- sowie `G2/G3`-Semantik,
- Fertigumlauf auf Werkzeugradiusabstand zur CAD-Kontur,
- Safe Stay-Down Linking bei nachweisbar sicheren Verbindungen,
- konservativer Safe-Z-Fallback, wenn Stay-Down nicht sicher bewiesen werden kann.

### Carve

- offene DXF-Geometrien als Centerline-Bearbeitung,
- Einzel- und Ebenenauswahl,
- nachträgliches Entfernen einzelner Elemente aus einer Ebenenvorauswahl,
- optimierte Fahrreihenfolge,
- mehrere Zustellungen,
- eigenständige Werkzeug- und Schnittdaten.

### Bohren

- native DXF-Kreise als Bohrreferenzen,
- Kreismittelpunkt als exakte Bohrachse,
- Einzel- und Ebenenauswahl mit editierbarer Vorauswahl,
- explizite portable `G0/G1`-Bohrbewegungen,
- mehrere Tiefenzustellungen,
- sichere XY-Verfahrbewegungen zwischen Bohrpositionen auf Safe-Z,
- deterministische Fahrwegoptimierung,
- keine Abhängigkeit von controller-spezifischen Canned Cycles.

## Gemeinsamer Operationskern

Alle vier Operationstypen besitzen unabhängige:

- Geometrieauswahl,
- Werkzeugdaten,
- Schnittdaten,
- Tiefenparameter,
- Preflight-Prüfung,
- Maschinenprogrammerzeugung.

Mehrere Operationen können zu einem Gesamtjob kombiniert werden. Werkzeugwechsel werden kontrolliert mit Safe-Z, `M5` und `M0` ausgegeben. Der Gesamtjob wird vor der Ausgabe projektweit geprüft.

## Sicherheits- und Transparenzprinzip

Der 001K-Meilenstein bestätigt die bisherige CAM-DNA:

**Keine versteckte Maschinenentscheidung ohne nachvollziehbaren Preflight.**

Werkzeugwege werden bevorzugt analytisch aus der CAD-Geometrie erzeugt. Optimierungen wie Stay-Down dürfen nur angewendet werden, wenn ihre Sicherheit nachgewiesen ist; andernfalls bleibt der konservative Maschinenpfad erhalten.

Die erzeugte `.nc` bleibt lesbar und prüfbar. G-Code-Kommentare benennen Operation, Strategie, Werkzeug und relevante Bewegungsmerkmale konsistent.

## Verifikation des Meilensteins

Die Entwicklung wurde nicht allein anhand der UI bewertet. Die Gates wurden wiederholt über mehrere Ebenen geprüft:

1. Geometrie und Auswahl in BeBlog CAM,
2. Preflight vor der Maschinenfreigabe,
3. direkte Kontrolle des erzeugten G-Codes,
4. externe Darstellung bzw. Materialsimulation in NC Viewer und/oder CAMotics.

Gate 9B schließt diesen Meilenstein mit einem real exportierten Bohrprogramm ab. Die Bohrpositionen, Tiefenzustellungen und Safe-Z-Bewegungen wurden direkt im G-Code kontrolliert; CAMotics bestätigte die vollständige Bearbeitung.

## Bewusst außerhalb von 001K

Der Meilenstein friert keinen endgültigen Funktionsumfang ein. Folgende Erweiterungen bleiben bewusst eigenständige spätere Gates:

- echtes Peck Drilling,
- `G81/G82/G83` als optionale controller-spezifische Ausgabe,
- DXF-POINT-Unterstützung,
- STEP-Bohrungserkennung,
- Helix-/Spiral-Aufbohren,
- komplexere Taschen mit Inseln und allgemeinen konkaven Topologien,
- weitere Fahrweg- und Parkstrategien.

Diese Funktionen dürfen die bereits bewiesenen 001K-Maschinenpfade nicht stillschweigend verändern, sondern benötigen jeweils einen eigenen Preflight und Realtest.

## Meilenstein-Freigabe

**001K = PASS.**

BeBlog CAM besitzt damit einen bewiesenen, zusammenhängenden klassischen 2D-CAM-Kern für typische Hobby-Maker-Arbeiten. Der weitere Ausbau erfolgt auf dieser Basis in neuen, klar abgegrenzten Gates.

## Danach

Als nächstes kann **Peck Drilling** als eigenes Gate folgen. Zusätzlich bleiben spätere Erweiterungen wie DXF-POINT-Unterstützung, STEP-Bohrungserkennung und Helix-Aufbohren getrennte Themen.
