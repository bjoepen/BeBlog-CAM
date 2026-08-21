# BeBlog CAM — Build 001L

## Ziel

001L ergänzt einen echten Postprozessor-Layer zwischen dem bewiesenen internen Maschinenpfad und der controller-spezifischen `.nc`-Ausgabe.

Die Werkzeugweg-Generatoren aus 001H–001K bleiben unverändert. Der Postprozessor darf keine Geometrie neu berechnen und keine freigegebene Bahn verändern.

## Gate 10A — Postprozessor-Basis für Real-World-Tests

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

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

## Real-World-Gate

Gate 10A ist vollständig PASS, wenn die jeweiligen Zielprogramme ihren Export korrekt interpretieren. Für den unmittelbar bevorstehenden Maschinenversuch liegt der Fokus zuerst auf Estlcam.

Geprüft werden insbesondere:

1. `pnpm check` und App-Build laufen sauber,
2. GRBL zeigt den bisherigen bewiesenen Referenz-G-Code unverändert,
3. Estlcam-Ausgabe enthält nur den freigegebenen Estlcam-Dialekt,
4. LinuxCNC behält `G17/G21/G90`, G0–G3, Spindelsteuerung und Programmende korrekt bei,
5. G2/G3 verwenden weiterhin relative I/J-Werte,
6. Kreise bleiben aus Teilbögen statt Vollkreisen aufgebaut,
7. Werkzeugwechsel halten weiterhin sicher mit M0 an,
8. eine ausgewählte Testdatei wird vom jeweiligen Zielsystem ohne Interpreterfehler geladen,
9. die controller-spezifische Vorschau bleibt geometrisch identisch zur zuvor in CAMotics bestätigten Bahn,
10. der reale Frästest mit Estlcam wird kontrolliert erfolgreich durchgeführt.

## Sicherheitsgrenze

Der erste reale Test beginnt mit konservativen Schnittdaten und einem bereits in CAMotics bestätigten einfachen Werkstück. Änderungen an Werkzeugwegen, Zustellstrategien oder Geometrie sind ausdrücklich nicht Bestandteil von Gate 10A.

**001L trennt damit erstmals sauber zwischen CAM-Geometrie und Controller-Dialekt, ohne den bewiesenen 001K-Kern zu verändern.**
