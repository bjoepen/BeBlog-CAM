# BeBlog CAM — Build 001L

## Ziel

001L ergänzt einen echten Postprozessor-Layer zwischen dem bewiesenen generischen Maschinenpfad und der controller-spezifischen `.nc`-Ausgabe. Der erste Zielcontroller ist **Estlcam** für den bevorstehenden Real-World-Test an der CNC.

Die Werkzeugweg-Generatoren aus 001H–001K bleiben unverändert. Der Postprozessor darf keine Geometrie neu berechnen und keine freigegebene Bahn verändern.

## Gate 10A — Estlcam Postprozessor

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

### Architektur

Neuer Kern:

- `src/lib/postprocessors.ts`
- `src/lib/postProcessorStore.ts`
- `src/lib/PostProcessorPicker.svelte`

Der Export kann zwischen zwei Ausgaben wählen:

- `Standard` — unveränderte bisherige BeBlog-CAM-Ausgabe,
- `Estlcam` — controller-spezifisch normalisierte Ausgabe.

Die Auswahl wird zentral im aktuellen App-Lauf gehalten und gilt damit konsistent für Kontur, Tasche, Carve, Bohren und Gesamtjob.

### Estlcam-Regeln

Der Postprozessor folgt den offiziellen Anforderungen des Estlcam-CNC-Interpreters:

- Bewegungen nur mit `G0`, `G1`, `G2`, `G3`,
- absolute XYZ-Koordinaten,
- G2/G3 im XY-Bereich mit relativen I/J-Werten,
- keine Vollkreise,
- keine Canned Cycles,
- keine Koordinatensystem- oder Ebenenwechsel,
- Kommentare in Klammern,
- unterstützte M-Befehle werden explizit beibehalten.

BeBlog CAM erfüllt die geometrischen Voraussetzungen bereits im Generator:

- Koordinaten sind absolut,
- I/J ist relativ zum jeweiligen Bogenstart,
- Kreise werden in zwei Halbkreise geteilt,
- Bohrungen werden als explizite G0/G1-Folgen ausgegeben.

### Normalisierung

Für Estlcam werden insbesondere:

- `G21`, `G90`, `G17` aus der Datei entfernt, weil Estlcam diese nicht als aktive Interpreterbefehle benötigt,
- `M30` entfernt,
- `S... M3` in getrennte `S...`- und `M3`-Zeilen zerlegt,
- `G00`–`G03` auf eindeutige `G0`–`G3`-Schreibweise normalisiert,
- nicht unterstützte G-/M-/T-Befehle nicht stillschweigend ausgegeben, sondern als Postprozessor-FAIL behandelt.

Der Postprozessor fügt am Programmende `M5` hinzu, falls der Quellcode nicht bereits mit Spindel-Aus endet.

### Werkzeugwechsel

Für den ersten Real-World-Test bleibt die bewiesene manuelle Werkzeugwechsel-Semantik erhalten:

- Safe-Z,
- `M5`,
- `M0` mit Werkzeughinweis,
- manuelles Bestätigen,
- danach Start der nächsten Operation.

Estlcams `M6` wird zunächst bewusst **nicht automatisch verwendet**, da Estlcam damit abhängig von der Maschinenkonfiguration Werkzeuglängenmessung bzw. Sensorabläufe auslösen kann. Ein späterer Estlcam-M6-Modus benötigt ein eigenes Gate.

### UX

Unter `06 · Fräsen` erscheint eine ruhige Auswahl:

`Standard | Estlcam`

Die Vorschau zeigt immer exakt die Datei, die gespeichert wird. Ein Postprozessor-FAIL blockiert Speichern und Kopieren.

Der Postprozessor ist in folgende Exportpfade integriert:

- Kontur,
- Tasche,
- Carve,
- Bohren,
- Multi-Operation-Gesamtjob.

### Real-World-Gate

Gate 10A ist PASS, wenn:

1. `pnpm check` und App-Build sauber durchlaufen,
2. Estlcam-Ausgabe keine anderen G-Befehle als G0–G3 enthält,
3. keine unsupported `M30`-Zeile mehr vorhanden ist,
4. alle Bewegungszeilen ihren G-Befehl explizit enthalten,
5. G2/G3 weiterhin relative I/J-Werte verwenden,
6. Kreise weiterhin aus Teilbögen statt Vollkreisen bestehen,
7. Werkzeugwechsel bei Multi-Operation weiterhin sicher mit M0 anhalten,
8. eine ausgewählte Testdatei von Estlcam ohne Interpreterfehler geladen wird,
9. der Estlcam-Vorschaupfad geometrisch mit der zuvor in CAMotics bestätigten Bahn übereinstimmt,
10. der erste reale Frästest an der Maschine kontrolliert erfolgreich durchgeführt wird.

## Sicherheitsgrenze

Der erste reale Test beginnt mit konservativen Schnittdaten und einem bereits in CAMotics bestätigten einfachen Werkstück. Änderungen an Werkzeugwegen, Zustellstrategien oder Geometrie sind ausdrücklich nicht Bestandteil von Gate 10A.

**Ziel von 001L ist ausschließlich: bewiesenen BeBlog-CAM-G-Code sicher in Estlcams Controller-Dialekt auszugeben.**
