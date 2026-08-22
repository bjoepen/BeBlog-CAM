# BeBlog CAM — Build 001J

## Ziel

001J erweitert den bewiesenen 2D-CAM-Kern um echte Taschen-Räumstrategien. Kontur, Carve, Rechtecktaschen und Multi-Operation bleiben Regression.

## Gate 8A — Kreistasche / konzentrische Räumstrategie

Status: **PASS / GESCHLOSSEN**

Die native DXF-Kreistasche wurde analytisch und extern in CAMotics bestätigt. Die Werkzeugmittelbahn hält den korrekten Werkzeugradius-Abstand zur CAD-Sollwand ein; die Kreisinterpolation bleibt nativ.

**Gate 8A = PASS.**

## Gate 8B — konturparallele Taschenräumung für gemischte geschlossene Konturen

Status: **PASS / GESCHLOSSEN**

Referenzmodell war `Test(1).dxf`, eine Langloch-/Kapselkontur aus LINE- und ARC-Segmenten. Degenerierte Null-Linien werden ignoriert.

Verbindliche Regel: **Linie bleibt Linie. Bogen bleibt Bogen.**

Bewiesen wurden:

- konturparallele Innenoffsets,
- Werkzeugradius-Abstand zur Sollwand,
- Stepover-Begrenzung,
- native LINE/ARC-Semantik bis in den Maschinenpfad,
- Preflight gegen kollabierende oder unsichere Offsets,
- vollständige Räumung des Langlochs,
- korrekte Darstellung in CAMotics.

Der Realtest bestätigt die vollständige Räumung ohne Verletzung der Sollkontur.

**Gate 8B = PASS.**

## Gate 8C — Safe Stay-Down Linking

Status: **PASS / GESCHLOSSEN**

### Ziel

Gate 8C optimiert ausschließlich die Verbindung zwischen den bereits bewiesenen konturparallelen Innenoffsets. Die Geometrie- und Offset-Mathematik aus 8B bleibt unverändert.

### Implementierter Linker

`src/lib/pocketStayDown.ts` arbeitet als konservativer Postprozessor ausschließlich auf dem bereits freigegebenen 8B-Konturparallel-G-Code.

Ein Safe-Z-Retract zwischen zwei Innenoffsets wird nur entfernt, wenn gleichzeitig gilt:

- nächster Offset ist analytisch der direkte Nachbar,
- Korrekturdifferenz ist größer als 0 und höchstens der konfigurierte Stepover,
- tatsächliche XY-Verbindung zwischen aktuellem geschlossenen Loop-Endpunkt und nächstem Loop-Start ist höchstens der konfigurierte Stepover,
- die Verbindung erfolgt als `G1` mit Schnittvorschub,
- keine Rapid-XY-Bewegung im Material wird erzeugt.

Ist eine Bedingung nicht eindeutig erfüllt, bleibt die originale 8B-Sequenz mit Safe-Z-Retract vollständig erhalten.

### Tiefenebenen

Stay-down gilt nur innerhalb derselben Z-Zustellung. Am Ende jeder Tiefenebene bleibt der Rückzug auf Sicherheits-Z unverändert erhalten. Dadurch wird der Wechsel auf die nächste Tiefenebene weiterhin konservativ ausgeführt.

### Exportpfade

Die Optimierung wird sowohl beim Einzel-Taschenexport als auch im Multi-Operation-Gesamtjob angewendet. Die G-Code-Vorschau zeigt exakt den optimierten Export.

`06 · Fräsen` weist bei konturparallelen Taschen zusätzlich die Anzahl tatsächlich verwendeter Stay-down-Links aus.

### Realtest

Referenzmodell erneut `Test(1).dxf`.

Der exportierte G-Code wurde geprüft. Innerhalb jeder Tiefenebene werden die acht validierten Innenoffsets ohne unnötige Safe-Z-Hübe miteinander verbunden. Die Verbindungen erfolgen als kurze `G1`-Links auf Arbeitstiefe und liegen jeweils innerhalb des zulässigen Stepovers. Bei acht Offsets und drei Tiefenebenen ergeben sich 21 sichere Stay-down-Verbindungen.

Bestätigt wurden:

- keine XY-Rapidfahrt im Material,
- keine Änderung der 8B-Offsetgeometrie,
- native `G1 + G2/G3`-Semantik bleibt erhalten,
- Rückzug auf Sicherheits-Z nur noch am Ende jeder Tiefenebene,
- vollständige Räumung in CAMotics,
- keine sichtbare Wandverletzung oder Materialrest gegenüber dem 8B-Referenzlauf.

Damit ist der Optimierungspfad funktional bewiesen.

**Gate 8C = PASS.**

### Kleiner Kommentar-Polish

Ein vorhandener Header-Kommentar aus 8B beschreibt noch das separate Safe-Z-Anfahren jedes Offsets. Dieser Text ist nach 8C veraltet und soll in einem reinen Polish-Commit auf die neue Stay-down-Logik angepasst werden. Die Maschinenbewegungen selbst sind davon nicht betroffen.

## 001J Meilenstein

Mit 8A, 8B und 8C besitzt BeBlog CAM jetzt drei bewiesene Taschenstrategien bzw. Pfade:

- Rechtecktasche über Raster,
- native Kreistasche über konzentrische G2/G3-Ringe,
- gemischte LINE/ARC-Tasche über konturparallele Innenoffsets mit sicheren Stay-down-Verbindungen.

Die CAD-Sollgeometrie bleibt in allen Fällen maßgeblich; Werkzeugwege sind ausschließlich radiuskorrigierte bzw. abgeleitete Maschinenbahnen.

## Danach

Nach 8C folgen allgemeinere Taschentopologien und anschließend **Gate 9 — Bohren**.
