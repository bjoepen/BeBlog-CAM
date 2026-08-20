# BeBlog CAM — Build 001J

## Ziel

001J erweitert den in 001H/001I bewiesenen 2D-CAM-Kern um echte Taschen-Räumstrategien. Die bestehenden Kontur-, Carve-, Rechtecktaschen- und Multi-Operation-Pfade bleiben unverändert und dienen als Regression.

## Gate 8A — Kreistasche / konzentrische Räumstrategie

Status: **PASS / GESCHLOSSEN**

### Referenzidee

Eine native DXF-Kreiskontur wird analytisch geräumt. Die CAD-Geometrie bleibt die fertige Taschenwand; daraus wird die maximal zulässige Fräsermittelbahn berechnet:

`R Werkzeugbahn außen = R Tasche − R Werkzeug`

Der Innenraum wird vom Zentrum nach außen über konzentrische Bahnen geräumt. Der äußerste Ring entspricht exakt der radiuskorrigierten Fertigwand.

### Bewiesener Realtest

Die Referenz-Kreistasche wurde extern in CAMotics geprüft und zusätzlich mathematisch am exportierten G-Code vermessen.

Bestätigt wurden:

- native DXF-Kreiskontur,
- Werkzeug Ø 3,000 mm,
- Sollradius 25,000 mm,
- äußerster Fräsermittelbahnradius 23,500 mm,
- Fertigwand exakt `23,500 + 1,500 = 25,000 mm`,
- 20 konzentrische Ringe,
- tatsächlicher radialer Stepover 1,175 mm bei maximal erlaubten 1,200 mm,
- jeder Ring als zwei native G3-Halbkreise,
- Z-Zustellungen sauber getrennt,
- keine XY-Rapidfahrt im Material,
- sauberes Jobende ohne redundante Safe-Z-Sequenzen.

**Gate 8A = PASS.**

## Gate 8B — konturparallele Taschenräumung für gemischte geschlossene Konturen

Status: **GEÖFFNET / IN ARBEIT**

### Referenzmodell

Verbindlicher Realtest ist die vom Nutzer bereitgestellte DXF `Test(1).dxf`.

Sie repräsentiert eine typische Langloch-/Kapselkontur aus:

- zwei geraden LINE-Segmenten,
- zwei ARC-Segmenten als Halbkreise,
- zusätzlich vorkommende degenerierte Null-Linien sind geometrisch bedeutungslos und müssen ignoriert werden.

Dieses Modell ist absichtlich gewählt, weil Gate 8B nicht nur Polygonpunkte nach innen schieben darf. Die semantische Geometrie muss erhalten bleiben:

**Linie bleibt Linie. Bogen bleibt Bogen.**

### Zielstrategie

Gate 8B führt eine neue Taschenstrategie `Konturparallel` ein.

Der Innenraum wird über sukzessive innere Werkzeugmittelbahnen geräumt. Jede Bahn entsteht aus der vorherigen bzw. aus der CAD-Sollkontur über einen mathematisch geprüften Innenoffset.

Für das Referenz-Langloch bedeutet das:

1. erste Werkzeugmittelbahn auf `Werkzeugradius` Abstand zur CAD-Wand,
2. weitere konturparallele Bahnen mit maximal dem eingestellten Stepover,
3. Geraden bleiben native G1-Segmente,
4. Halbkreise bleiben native G2/G3-Bögen,
5. letzte gültige Innenbahn räumt den verbleibenden Kernbereich,
6. Fertigumlauf liegt exakt auf der radiuskorrigierten Innenkontur.

### UX in `04 · Bearbeiten`

Die Räumstrategien werden erweitert zu:

- `Automatisch`
- `Raster`
- `Kreis`
- `Konturparallel`

Gate-8B-Regeln:

- `Raster` bleibt der bewiesene Rechteckpfad,
- `Kreis` bleibt der bewiesene native Kreis-Pfad,
- `Konturparallel` akzeptiert zunächst geschlossene gemischte Konturen aus unterstützten LINE-/ARC-Segmenten,
- `Automatisch` darf Gate 8B erst dann auf `Konturparallel` wechseln, wenn die Geometrie eindeutig als unterstützt erkannt wurde,
- keine stille Segmentierung und kein stiller Fallback.

### Geometrische Sicherheitsregeln

Jeder innere Offset muss vor G-Code-Freigabe geprüft werden.

FAIL bei:

- Werkzeug passt nicht vollständig in die Tasche,
- Offset kollabiert oder besitzt keinen nutzbaren Innenraum mehr,
- negativer oder nullförmiger Bogenradius,
- Selbstüberschneidung der erzeugten Offsetkontur,
- Segmentanschlüsse sind geometrisch nicht mehr geschlossen,
- Offset würde die Sollwand unterschreiten,
- nicht unterstützte Segmenttypen müssen für 8B explizit abgelehnt werden.

Degenerierte Nullsegmente werden nicht als Bearbeitungsgeometrie behandelt.

### Interpolation

Verbindliche Regel:

**Unterstützte native CAD-Semantik bleibt bis zum G-Code erhalten.**

Für `Test(1).dxf` erwarten wir deshalb eine gemischte Werkzeugbahn aus G1 und G2/G3, keine vollständig segmentierte G1-Approximation.

### Eintauchen

Gate 8B startet konservativ mit senkrechtem Eintauchen.

Die bestehende lineare Rampe bleibt ausschließlich dort freigegeben, wo ihre Geometrie analytisch bewiesen ist. Eine allgemeine Rampe oder Helix für konturparallele Taschen ist ein separates späteres Gate.

### Preflight

`05 · Prüfen` muss bei konturparallelen Taschen sichtbar ausweisen:

- erkannte Segmentsemantik,
- Werkzeugradius,
- Anzahl erzeugter Offsetbahnen,
- tatsächlichen maximalen Stepover,
- minimale verbleibende Offsetradien,
- geschlossene Segmentanschlüsse,
- keine Selbstüberschneidung,
- Fertigumlauf exakt auf Werkzeugradius-Abstand zur CAD-Sollwand,
- verwendete native Interpolation G1 + G2/G3.

### Gate-8B-Realtest

Gate 8B ist erst PASS, wenn `Test(1).dxf` folgendes erfüllt:

1. als Taschenkontur auswählbar,
2. `Konturparallel` wird akzeptiert,
3. Preflight ist geometrisch PASS bzw. nur wegen bekannter Rohlinghinweise WARN,
4. exportierter G-Code enthält native G1-Linien und G2/G3-Bögen,
5. keine Offsetbahn überschreitet die CAD-Sollwand,
6. der Innenraum wird vollständig geräumt,
7. CAMotics und NC Viewer zeigen die erwartete Langlochtasche,
8. bestehende Rechteck-Raster- und Kreis-Konzentrisch-Pfade zeigen keine Regression.

### Scope-Grenze

Gate 8B behandelt noch **keine** allgemeinen konkaven Taschen, Inneninseln oder mehrere voneinander getrennte Innenräume. Diese benötigen eigene Offset-/Topologie-Gates.

## Danach

Nach Gate 8B folgen getrennt:

- allgemeinere konturparallele Taschen inklusive schwierigerer Topologien,
- anschließend der eigenständige Meilenstein **Gate 9 — Bohren**.
