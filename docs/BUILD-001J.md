# BeBlog CAM — Build 001J

## Ziel

001J erweitert den in 001H/001I bewiesenen 2D-CAM-Kern um echte Taschen-Räumstrategien. Die bestehenden Kontur-, Carve-, Rechtecktaschen- und Multi-Operation-Pfade bleiben unverändert und dienen als Regression.

## Gate 8A — Kreistasche / konzentrische Räumstrategie

Status: **PASS / GESCHLOSSEN**

Die native DXF-Kreistasche wurde analytisch und extern in CAMotics bestätigt. Der äußerste Fräsermittelbahnradius entspricht exakt `R Tasche − R Werkzeug`; die Räumung verwendet native G3-Halbkreise.

**Gate 8A = PASS.**

## Gate 8B — konturparallele Taschenräumung für gemischte geschlossene Konturen

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

### Referenzmodell

Verbindlicher Realtest ist `Test(1).dxf`, eine Langloch-/Kapselkontur aus zwei LINE- und zwei ARC-Segmenten. Degenerierte Null-Linien werden durch den semantischen Konturaufbau ignoriert.

Verbindliche Regel:

**Linie bleibt Linie. Bogen bleibt Bogen.**

### Implementierter Kern

`src/lib/parallelPocketMath.ts` erzeugt konservative konturparallele Innenoffsets auf Basis der bereits bewiesenen nativen `SemanticContour`-Geometrie.

Geprüft werden:

- unterstützte geschlossene native Kontur,
- mindestens ein nativer ARC im Gate-8B-Scope,
- Werkzeugdurchmesser und Stepover,
- jeder Offset über `offsetSemanticContour(..., -correction)`,
- bestehende analytische Offsetvermessung,
- kollabierende Bögen,
- angenäherte Selbstüberschneidung der resultierenden Offsetkontur,
- sichere Kernabdeckung vor Freigabe.

Die erste Bahn liegt exakt einen Werkzeugradius innerhalb der CAD-Wand. Weitere Bahnen werden höchstens um den gewählten Stepover nach innen versetzt.

### G-Code-Kern

`src/lib/pocketGcode.ts` besitzt drei Strategien:

- `raster`,
- `concentric`,
- `parallel`.

Bei `Automatisch` gilt:

1. nativer Kreis → `concentric`,
2. gültige achsparallele Rechtecktasche → `raster`,
3. sonst unterstützte gemischte native Kontur → `parallel`.

Es gibt keinen stillen Rückfall auf segmentierte G1-Geometrie.

Konturparallel wird mit nativer Semantik ausgegeben:

- LINE → `G1`,
- ARC CCW → `G3`,
- ARC CW → `G2`.

Jeder Innenoffset wird konservativ separat auf Safe-Z angefahren und senkrecht eingetaucht. Die allgemeine Rampe bleibt für Gate 8B gesperrt.

### Preflight

`05 · Prüfen` versteht die konturparallele Strategie nun explizit und bestätigt sichtbar:

- erkannte native LINE/ARC-Semantik,
- Anzahl LINE- und ARC-Segmente,
- Werkzeugradius,
- Anzahl analytisch erzeugter Innenoffsets,
- angeforderten und tatsächlichen maximalen Stepover,
- kleinsten verbleibenden Bogenradius,
- Offset-Sicherheit einschließlich Kontinuität und Selbstüberschneidungsprüfung,
- erster/Fertigumlauf exakt auf Werkzeugradius-Abstand zur CAD-Sollwand,
- native Interpolation `G1 + G2/G3`.

Ein ungültiger Offset, kollabierender Bogen, zu großes Werkzeug oder nicht sicher geräumter Kern setzt die Operation auf **FAIL**. Eine lineare Rampe bleibt für Konturparallel ebenfalls **FAIL**.

### Operationsmodell

`PocketStrategy` enthält nun auch `parallel`. Die Bearbeitungsliste kann die Strategie als `Konturparallel` ausweisen. `Automatisch` reicht bereits für den verbindlichen Referenztest; die explizite Auswahl in der kompakten Strategie-UX wird als kleiner UI-Abschluss innerhalb 8B behandelt und verändert den Maschinenpfad nicht.

### Gate-8B-Realtest

PASS erst wenn `Test(1).dxf`:

1. als Tasche mit `Automatisch` erkannt und intern auf `parallel` aufgelöst wird,
2. Preflight freigabefähig ist,
3. `.nc` native G1- und G2/G3-Segmente enthält,
4. keine Offsetbahn die CAD-Sollwand überschreitet,
5. der Innenraum vollständig geräumt wird,
6. CAMotics und NC Viewer die erwartete Langlochtasche zeigen,
7. Rechteck-Raster und Kreis-Konzentrisch regressionsfrei bleiben.

### Scope-Grenze

Gate 8B behandelt noch keine allgemeinen konkaven Taschen, Inneninseln oder mehrere getrennte Innenräume. Diese benötigen eigene Topologie-Gates.

## Danach

Nach Gate 8B folgen getrennt allgemeinere Topologien und anschließend **Gate 9 — Bohren**.
