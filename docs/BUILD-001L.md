# BeBlog CAM — Build 001L

## Ziel

001L ergänzt einen echten Postprozessor-Layer zwischen dem bewiesenen internen Maschinenpfad und der controller-spezifischen `.nc`-Ausgabe.

Die Werkzeugweg-Generatoren aus 001H–001K bleiben unverändert. Der Postprozessor darf keine Geometrie neu berechnen und keine freigegebene Bahn verändern.

## Build-Status

Status: **SEMI-PASS / REAL-WORLD-TEST AUSSTEHEND**

Die Software- und Dateiprüfungen für `GRBL`, `Estlcam` und `LinuxCNC` sind erfolgreich. Die erzeugten controller-spezifischen Dateien wurden strukturell geprüft; Estlcam- und LinuxCNC-Ausgaben entsprechen den erwarteten Dialekten und behalten die bewiesenen Werkzeugwege bei.

Der Build bleibt bewusst auf **SEMI-PASS**, bis der geplante kontrollierte Real-World-Test an der CNC durchgeführt wurde. Erst der erfolgreiche Maschinenlauf darf 001L auf vollständiges PASS setzen.

## Gate 10A — Postprozessor-Basis für Real-World-Tests

Status: **SEMI-PASS / MASCHINENTEST AUSSTEHEND**

### Architektur

Neuer Kern:

- `src/lib/postprocessors.ts`
- `src/lib/postProcessorStore.ts`
- `src/lib/PostProcessorPicker.svelte`

Der Export kann nun zwischen drei expliziten Zielsystemen wählen:

- `GRBL`
- `Estlcam`
- `LinuxCNC`

Die Auswahl wird zentral im aktuellen App-Lauf gehalten und gilt konsistent für Kontur, Tasche, Carve, Bohren und Gesamtjob.

Verbindliches Architekturprinzip:

**interner CAM-Werkzeugweg → Postprozessor → controller-spezifische `.nc`-Datei**

Der bisherige namenlose `Standard`-Pfad wird damit ausdrücklich als **GRBL** benannt. Er bleibt geometrisch und maschinell identisch zum bereits bewiesenen bisherigen Standard-G-Code.

## GRBL

GRBL ist der explizite Referenz-Postprozessor für den bisherigen BeBlog-CAM-G-Code.

Der bewiesene Generator verwendet bereits den benötigten Kern:

- `G21` Millimeter,
- `G90` absolute Koordinaten,
- `G17` XY-Ebene,
- `G0/G1/G2/G3`,
- relative `I/J` bei Bögen,
- `S... M3`,
- `M5`,
- `M0` für manuellen Werkzeugwechsel,
- `M30` als Programmende.

Der GRBL-Postprozessor verändert den bewiesenen Quellpfad daher derzeit bewusst nicht. Seine Aufgabe in 001L ist die explizite Controller-Zuordnung statt eines unklaren `Standard`-Labels.

## Estlcam

Der Estlcam-Postprozessor folgt dem bereits für den Real-World-Test vorbereiteten konservativen Dialekt:

- Bewegungen nur mit `G0`, `G1`, `G2`, `G3`,
- absolute XYZ-Koordinaten,
- G2/G3 im XY-Bereich mit relativen I/J-Werten,
- keine Vollkreise,
- keine Canned Cycles,
- keine Koordinatensystem- oder Ebenenwechsel,
- Kommentare in Klammern,
- unterstützte M-Befehle werden explizit beibehalten.

Für Estlcam werden insbesondere:

- `G21`, `G90`, `G17` aus der Datei entfernt,
- `M30` entfernt,
- `S... M3` in getrennte `S...`- und `M3`-Zeilen zerlegt,
- `G00`–`G03` auf `G0`–`G3` normalisiert,
- nicht unterstützte G-/M-/T-Befehle als Postprozessor-FAIL behandelt.

Der Postprozessor fügt am Programmende `M5` hinzu, falls der Quellcode nicht bereits mit Spindel-Aus endet.

### Werkzeugwechsel in Estlcam

Für den ersten Real-World-Test bleibt die bewiesene manuelle Werkzeugwechsel-Semantik erhalten:

- Safe-Z,
- `M5`,
- `M0` mit Werkzeughinweis,
- manuelles Bestätigen,
- danach Start der nächsten Operation.

Estlcams `M6` wird zunächst bewusst **nicht automatisch verwendet**, da damit abhängig von der Maschinenkonfiguration Werkzeuglängenmessung bzw. Sensorabläufe ausgelöst werden können.

## LinuxCNC

LinuxCNC erhält in 001L einen eigenen expliziten Postprozessor.

Der aktuelle BeBlog-CAM-Werkzeugweg passt sehr gut zum LinuxCNC-Interpreter. LinuxCNC unterstützt insbesondere:

- `G17` für die XY-Ebene,
- `G21` für Millimeter,
- `G90` für absolute Koordinaten,
- `G0/G1/G2/G3`,
- relative `I/J` für die von BeBlog CAM erzeugten XY-Bögen,
- `M3/M5` für die Spindel,
- `M0` als Programmpause,
- `M30` als Programmende.

Der LinuxCNC-Postprozessor hält deshalb die bewiesene Geometrie vollständig erhalten und normalisiert lediglich die Schreibweise. Unerwartete controller-spezifische G-/M-/T-Befehle werden im aktuellen Gate nicht stillschweigend akzeptiert, sondern als FAIL behandelt.

Für den ersten LinuxCNC-Scope sind `G20` und `G91` bewusst gesperrt: BeBlog CAM arbeitet im geprüften 2D-Kern mit Millimetern und absoluten Koordinaten.

LinuxCNC-spezifische Möglichkeiten wie `G64`, Werkzeugtabellen, `Tn M6`, `G43`, Canned Cycles oder maschinenkoordinierte `G53`-Parkbewegungen werden **noch nicht automatisch erzeugt**. Sie benötigen später eigene Gates, weil sie Maschinenkonfiguration und Werkzeugmanagement berühren.

## UX

Unter `06 · Fräsen` erscheint nun die klare Auswahl:

`GRBL | Estlcam | LinuxCNC`

Die Vorschau zeigt immer exakt die Datei, die gespeichert wird. Ein Postprozessor-FAIL blockiert Speichern und Kopieren.

Der Postprozessor ist in folgende Exportpfade integriert:

- Kontur,
- Tasche,
- Carve,
- Bohren,
- Multi-Operation-Gesamtjob.

## Bisherige Verifikation

Softwareseitig bestätigt sind:

1. explizite Auswahl `GRBL | Estlcam | LinuxCNC`,
2. GRBL bleibt der bisherige bewiesene Referenzpfad,
3. Estlcam-Ausgabe entfernt die nicht benötigten Modal-/Endcodes und behält die Werkzeugweggeometrie,
4. LinuxCNC-Ausgabe behält `G17/G21/G90`, G0–G3, Spindelsteuerung und `M30`,
5. G2/G3 verwenden weiterhin relative I/J-Werte,
6. Kreise bleiben aus Teilbögen statt Vollkreisen aufgebaut,
7. die bereits in CAMotics bestätigte konturparallele Tasche bleibt in allen PP geometrisch identisch.

## Offener Real-World-Gate

Zum vollständigen PASS fehlen noch die kontrollierten Interpreter-/Maschinentests. Für den unmittelbar bevorstehenden ersten Maschinenversuch liegt der Fokus auf Estlcam.

Der Real-World-Test prüft insbesondere:

1. Datei wird im Zielsystem ohne Interpreterfehler geladen,
2. Vorschau entspricht der zuvor in CAMotics bestätigten Bahn,
3. Safe-Z, Spindelstart/-stopp und Zustellungen werden korrekt ausgeführt,
4. G2/G3-Bögen werden an der Maschine korrekt interpretiert,
5. die reale Fräsgeometrie entspricht nach Vermessung der Sollgeometrie.

## Sicherheitsgrenze

Der erste reale Test beginnt mit konservativen Schnittdaten und einem bereits in CAMotics bestätigten einfachen Werkstück. Änderungen an Werkzeugwegen, Zustellstrategien oder Geometrie sind ausdrücklich nicht Bestandteil von Gate 10A.

**001L = SEMI-PASS.**

Der Softwarepfad ist freigegeben; die vollständige Meilensteinfreigabe erfolgt erst nach dem realen CNC-Test.
