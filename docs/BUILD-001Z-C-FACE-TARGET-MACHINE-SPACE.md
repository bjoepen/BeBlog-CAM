# 001Z-C — Face-Target Roughing in Machine/WCS Space

## Ziel

Der bisherige Face-Target-Proof verwendete für seine kanonischen Runs noch positive Stock-/Viewport-Z-Koordinaten. Das war für eine Vorschau ausreichend, aber nicht für einen echten Postprozessorpfad.

001Z-C normalisiert deshalb den Face-Target-Toolpath auf dieselbe Koordinatenregel wie die übrigen CAM-Operationen:

`Canonical Toolpath = WCS-/Maschinenkoordinaten`

## Invarianten

- ausgewählte BRep-Zielfläche bleibt alleiniger XY-Bearbeitungsbereich,
- seitliche Rohlingüberstände bleiben unangetastet,
- innere Öffnungen bleiben ausgespart,
- `run.z` ist WCS-relativ und bei WCS Z oben negativ,
- `run.points` sind XY-relativ zum aktiven WCS,
- Viewport rekonstruiert aus demselben kanonischen Toolpath wieder Stock-/Weltkoordinaten,
- vollständige XY-Zone wird auf einer Z-Ebene geräumt, bevor die nächste Tiefe beginnt,
- WCS Z unten ist für Face-Target-Roughing aktuell nicht freigegeben.

## Postprozessor-Vorbereitung

`postFaceTargetCanonicalToolpath()` serialisiert den kanonischen Pfad bereits controller-neutral in explizite G0/G1-Bewegungen.

Dieser Serializer wird erst im nächsten Integrationsschritt an `Prüfen → Fräsen` angeschlossen. Dadurch bleibt der Geometrie-Gate dieses Builds isoliert testbar.

## Real-World Gate

CBG-Kopfplatte:

1. obere Ziel-BRep-Fläche wählen,
2. Roughing-Zone bleibt ausschließlich in deren XY-Projektion,
3. Bohrungen/Öffnungen bleiben frei,
4. seitliches Spannmaterial bleibt frei,
5. letzte Z-Ebene entspricht `targetZ + finishAllowance`,
6. Werkzeugbahn räumt Ebene für Ebene,
7. Kamerabewegung verändert keine kanonische Geometrie.
