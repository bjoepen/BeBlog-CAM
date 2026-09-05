# Build 004L — Kontur Aufmaß + Schlichtdurchgänge

## Ziel
Geschlossene DXF- und STEP-Konturen erhalten einen gemeinsamen kanonischen Schrupp-/Schlichtvertrag.

## Vertrag
- `radialAllowanceMm`: radiales Aufmaß auf der Seitenwand
- `axialAllowanceMm`: axiales Aufmaß am Konturboden / an der Endtiefe
- `finishPassEnabled`: Sollmaß-Schlichtdurchgang aktiv
- `finishPassCount`: Anzahl der Sollmaß-Durchgänge; Werte > 1 dienen als Wiederhol-/Spring-Pässe

## Reihenfolge
1. nominale Kontur / Werkzeugradiuskorrektur
2. 004L Aufmaß + Schlichtdurchgänge
3. Haltestege
4. Lead-in / Lead-out
5. Postprozessor

Damit bleiben Tabs auch im Schlichtgang erhalten und Leads werden erst auf die fertige Run-Folge gesetzt.

## Geometrie
- Außenkontur: radiales Schruppaufmaß verschiebt die Werkzeugmitte weiter nach außen.
- Innenkontur: radiales Schruppaufmaß verschiebt die Werkzeugmitte weiter in die freie Tasche hinein.
- `Auf Linie`: radiales Aufmaß ist nicht eindeutig und wird gesperrt.
- Axiales Aufmaß begrenzt die Schrupptiefe auf `Endtiefe - axiales Aufmaß`.
- Aktiviertes Schlichten fährt anschließend wieder die nominale Kontur auf voller Endtiefe.

## Sicherheitsgrenzen
- zunächst nur geschlossene Konturen
- Aufmaße dürfen nicht negativ sein
- axiales Aufmaß muss kleiner als die gesamte Endtiefe sein
- Aufmaß ohne aktivierten Schlichtdurchgang ist erlaubt, erzeugt aber eine Warnung

## Gates
`pnpm check:004l`
`pnpm check`
`pnpm build`

Keine OCCT-/C++-Änderung; `pnpm native:test` ist nicht erforderlich.
