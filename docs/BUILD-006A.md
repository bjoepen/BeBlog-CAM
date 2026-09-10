# Build 006A — Estlcam Production Gate

## Ziel

Build 006A macht Estlcam zum ersten praktischen Controller-Ziel für den BeBlog-CAM-Gesamtjob, ohne den CAM-Kernel oder die bereits freigegebene Maschinenbewegung neu zu definieren.

Der Build schließt an 005A–005C an:

**Prüfen → Gesamtjob-Preview → Simulation → Inspector → Postprozessor → Steuerung**

## Verbindliche Grenze

> **Postprocessing changes controller syntax, not machining truth.**

Die vorhandenen Contracts bleiben bestehen:

- Canonical Toolpath bleibt Quelle der geometrischen Bearbeitungswahrheit.
- 004T Safe Motion bleibt unverändert.
- 004T-A Initial Safe Entry bleibt unverändert.
- Preview / Simulation / Inspector / Preflight / NC verwenden weiterhin dieselbe freigegebene Motion-Wahrheit.
- 006A erzeugt oder rekonstruiert keine Werkzeugwege.

## Estlcam-Vertrag

Der Estlcam-Postprozessor erhält einen bewusst konservativen Dialekt:

- nur G0/G1/G2/G3 werden als Bewegungs-G-Codes ausgegeben;
- absolute XYZ-Koordinaten bleiben erhalten;
- XY-Kreisbögen verwenden die vorhandenen relativen I/J-Werte;
- nicht benötigte bzw. von Estlcam nicht unterstützte Modal-/Endcodes werden entfernt;
- `S` und `M3` werden auf getrennte Zeilen normalisiert;
- Werkzeugwechsel werden als eigenständiges `M6` ausgegeben;
- `M6` erhält keine `T`-Nummer und keine Zusatzparameter;
- der controller-neutrale Gesamtjob bleibt bei seinem manuellen Werkzeugwechselmarker; erst der Estlcam-Postprozessor übersetzt diesen Marker in `M6`;
- `M30` wird nicht an Estlcam ausgegeben.

## Werkzeugwechsel

Der rohe Gesamtjob bleibt controller-neutral:

```text
M5
( Werkzeugwechsel 1 )
M0 ( Werkzeug ... einsetzen und bestaetigen )
```

Der Estlcam-Postprozessor erzeugt daraus:

```text
M5
( Werkzeugwechsel 1 )
( Werkzeug ... einsetzen und bestaetigen )
M6
```

Damit kann Estlcam seine eigene Werkzeugwechsel- und Werkzeuglängensensor-Logik ausführen. BeBlog CAM selbst übernimmt kein Probing und keine Werkzeuglängenmessung.

## Controller Boundary

Probing, Antasten, Werkzeuglängenmessung und das reale Einrichten des WCS bleiben Aufgaben der Maschinensteuerung. BeBlog CAM stellt die freigegebene Bearbeitungs- und Bewegungsinformation sowie den passenden Controller-Dialekt bereit.

## Gate

`pnpm run check:006a` prüft sowohl die Architekturgrenzen als auch ein ausführbares Zweiwerkzeug-Fixture durch den realen Estlcam-Postprozessor.

Das Fixture muss insbesondere nachweisen:

- genau ein `M6` bei einem Werkzeugwechsel;
- kein Werkzeugwechsel-`M0` im Estlcam-Ergebnis;
- kein `T` und keine Parameter an `M6`;
- kein `M30`;
- getrennte `S`- und `M3`-Zeilen;
- ausschließlich G0–G3 im Estlcam-Ergebnis;
- fail-closed bei `M6 T...`.

## Real-World Acceptance

Vor Merge muss ein echter exportierter Mehrwerkzeug-Gesamtjob in Estlcam geladen und geprüft werden:

1. Programm wird ohne Dialektfehler geladen.
2. 004T-A Initial Safe Entry bleibt sichtbar und plausibel.
3. Erster Bearbeitungsblock startet mit korrekter Drehzahl.
4. Vor Werkzeugwechsel wird die Spindel mit `M5` gestoppt.
5. Estlcam erkennt `M6` als Werkzeugwechsel.
6. Nach Bestätigung bzw. controllerseitiger Werkzeuglängenbehandlung wird der nächste Bearbeitungsblock korrekt fortgesetzt.
7. Zwischen den Operationen bleibt die freigegebene Safe-Motion-Sequenz erhalten.
8. Programmende erfolgt ohne auf einen von Estlcam ignorierten `M30` angewiesen zu sein.

## Nicht Bestandteil von 006A

- CAM-Kernel-Änderungen
- neue Werkzeugwegstrategien
- eigene Probing-Zyklen
- eigene Touchplate-/Werkzeuglängensensor-Logik
- Stock-Removal-Simulation
- automatische Werkzeugnummernverwaltung / ATC
