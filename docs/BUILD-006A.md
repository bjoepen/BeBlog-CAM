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

## Spindelzustand im Gesamtjob — 006A-F01

Der Gesamtjob verwaltet den Spindelzustand über Operationsgrenzen hinweg:

- gleiches Werkzeug + gleiche Drehzahl → Spindel läuft weiter, kein erneutes `M3`;
- gleiches Werkzeug + neue Drehzahl → nur neues `S...`;
- echtes Werkzeugwechselereignis → `M5`, controller-neutraler Werkzeugwechselmarker, anschließend Neustart mit `M3 S...`;
- Programmende → genau ein abschließendes `M5`, sofern die Spindel noch läuft.

Damit werden unnötige Stop/Start-Zyklen zwischen Operationen mit demselben Werkzeug vermieden.

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

## Drill Safe Anchor — 006A-F02

Beim Vergleich mit einem echten Estlcam-11-NC wurde ein falscher Übergang vor einer DXF-Bohrbearbeitung sichtbar:

```text
G0 X0.000 Y0.000 Z5.000
G0 X0.000 Y0.000 Z0.000
```

Root Cause war der Drill-Canonicalizer: unbekannte modale X/Y/Z-Werte wurden initial als `(0,0,0)` angenommen. Dadurch konnte der WCS-Ursprung fälschlich als echter Maschinen-Startanker in 004T und den Job-Linker gelangen.

F02 behebt dies an der Quelle:

- unbekannte Achsen bleiben unbekannt, bis X/Y/Z tatsächlich bestimmt sind;
- Maschinenbewegungen werden erst ab einem vollständig bekannten XYZ-Anker materialisiert;
- der erste DXF-Drill-Anker liegt dadurch an der realen Bohrposition auf `Safe-Z`;
- der 004T-Übergang nach einem Werkzeugwechsel bleibt vollständig auf Safe-Z und fährt nicht unbegründet auf Z0;
- der Standalone-Drill-Poster erhält weiterhin eine explizite Initial Safe Entry: zuerst Z auf den bekannten Safe-Z-Anker, danach XY.

Der Estlcam-Postprozessor und der 004T-Linker selbst bleiben dabei unverändert.

## Controller Boundary

Probing, Antasten, Werkzeuglängenmessung und das reale Einrichten des WCS bleiben Aufgaben der Maschinensteuerung. BeBlog CAM stellt die freigegebene Bearbeitungs- und Bewegungsinformation sowie den passenden Controller-Dialekt bereit.

## Gate

`pnpm run check:006a` prüft sowohl die Architekturgrenzen als auch ein ausführbares Zweiwerkzeug-Fixture durch den realen Estlcam-Postprozessor.

Das Gate weist insbesondere nach:

- genau ein `M6` bei einem Werkzeugwechsel;
- kein Werkzeugwechsel-`M0` im Estlcam-Ergebnis;
- kein `T` und keine Parameter an `M6`;
- kein `M30`;
- getrennte `S`- und `M3`-Zeilen;
- ausschließlich G0–G3 im Estlcam-Ergebnis;
- fail-closed bei `M6 T...`;
- F02: kein erfundener `(0,0,0)`-Maschinenanker im DXF-Drill-Canonicalizer;
- F02: erster Drill-Anker liegt an der realen Bohrposition auf Safe-Z;
- F02: Toolchange→Drill-Transition bleibt auf Safe-Z und erzeugt keinen unbegründeten Rapid zu Z0.

## Real-World Acceptance

Vor Merge muss ein echter exportierter Mehrwerkzeug-Gesamtjob in Estlcam geladen und geprüft werden:

1. Programm wird ohne Dialektfehler geladen.
2. 004T-A Initial Safe Entry bleibt sichtbar und plausibel.
3. Erster Bearbeitungsblock startet mit korrekter Drehzahl.
4. Operationen mit demselben Werkzeug und gleicher Drehzahl erzeugen keinen erneuten Spindelstart.
5. Vor echtem Werkzeugwechsel wird die Spindel mit `M5` gestoppt.
6. Estlcam erkennt `M6` als Werkzeugwechsel.
7. Nach Bestätigung bzw. controllerseitiger Werkzeuglängenbehandlung wird der nächste Bearbeitungsblock korrekt fortgesetzt.
8. Toolchange→Drill bleibt auf Safe-Z; insbesondere darf kein künstlicher Rapid nach WCS `(0,0,0)` bzw. auf Z0 erscheinen.
9. Zwischen den Operationen bleibt die freigegebene Safe-Motion-Sequenz erhalten.
10. Programmende erfolgt ohne auf einen von Estlcam ignorierten `M30` angewiesen zu sein.

## Nicht Bestandteil von 006A

- neue Werkzeugwegstrategien
- eigene Probing-Zyklen
- eigene Touchplate-/Werkzeuglängensensor-Logik
- Stock-Removal-Simulation
- automatische Werkzeugnummernverwaltung / ATC
