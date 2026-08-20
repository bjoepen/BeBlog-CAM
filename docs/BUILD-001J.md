# BeBlog CAM — Build 001J

## Ziel

001J erweitert den in 001H/001I bewiesenen 2D-CAM-Kern um echte Taschen-Räumstrategien. Die bestehenden Kontur-, Carve-, Rechtecktaschen- und Multi-Operation-Pfade bleiben unverändert und dienen als Regression.

## Gate 8A — Kreistasche / konzentrische Räumstrategie

Status: **PASS / GESCHLOSSEN**

Die native DXF-Kreistasche wurde analytisch und extern in CAMotics bestätigt. Der äußerste Fräsermittelbahnradius entspricht exakt `R Tasche − R Werkzeug`; die Räumung verwendet native G3-Halbkreise.

**Gate 8A = PASS.**

## Gate 8B — konturparallele Taschenräumung für gemischte geschlossene Konturen

Status: **KERNEL IMPLEMENTIERT / PREFLIGHT & REALTEST AUSSTEHEND**

### Referenzmodell

Verbindlicher Realtest ist `Test(1).dxf`, eine Langloch-/Kapselkontur aus zwei LINE- und zwei ARC-Segmenten. Degenerierte Null-Linien werden durch den semantischen Konturaufbau ignoriert.

Verbindliche Regel:

**Linie bleibt Linie. Bogen bleibt Bogen.**

### Implementierter Kern

`src/lib/parallelPocketMath.ts` erzeugt konservative konturparallele Innenoffsets auf Basis der bereits bewiesenen nativen `SemanticContour`-Geometrie.

Geprüft werden derzeit:

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

`src/lib/pocketGcode.ts` besitzt nun eine dritte interne Strategie:

- `raster`
- `concentric`
- `parallel`

Bei `Automatisch` gilt im aktuellen 8B-Kernel:

1. nativer Kreis → `concentric`,
2. gültige achsparallele Rechtecktasche → `raster`,
3. sonst unterstützte gemischte native Kontur → `parallel`.

Es gibt keinen stillen Rückfall auf segmentierte G1-Geometrie.

Konturparallel wird mit nativer Semantik ausgegeben:

- LINE → `G1`,
- ARC CCW → `G3`,
- ARC CW → `G2`.

Jeder Innenoffset wird konservativ separat auf Safe-Z angefahren und senkrecht eingetaucht. Die allgemeine Rampe bleibt für Gate 8B gesperrt.

### Sicherheitsgrenze des ersten Kernschritts

Gate 8B ist **noch nicht PASS**. Der neue Maschinenpfad ist absichtlich noch nicht über den vollständigen Einzel-Preflight freigegeben. `05 · Prüfen` muss als nächster Schritt die neue Strategie explizit verstehen und darf nicht mehr von der alten Rechtecktaschenprüfung ausgehen.

Erst danach erfolgt der Realtest mit `Test(1).dxf`.

### Geplanter Preflight

Der Gate-8B-Preflight muss sichtbar bestätigen:

- erkannte native LINE/ARC-Semantik,
- Werkzeugradius,
- Anzahl erzeugter Innenoffsets,
- maximalen tatsächlichen Stepover,
- minimale verbleibende Bogenradien,
- geschlossene Segmentanschlüsse,
- keine Selbstüberschneidung,
- erster/Fertigumlauf exakt auf Werkzeugradius-Abstand zur CAD-Sollwand,
- native Interpolation `G1 + G2/G3`.

### Gate-8B-Realtest

PASS erst wenn `Test(1).dxf`:

1. als Tasche mit `Automatisch` bzw. später explizit `Konturparallel` erkannt wird,
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
