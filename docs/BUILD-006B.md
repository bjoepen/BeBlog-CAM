# Build 006B — DXF Multi-Target Operations

## Ziel

Eine einzelne DXF-Bearbeitung kann mehrere geschlossene Geometrieziele besitzen. Werkzeug- und Schnittparameter gelten gemeinsam für alle gewählten Ziele.

## Scope

- DXF Kontur: mehrere geschlossene Konturen pro Operation
- DXF Tasche: mehrere geschlossene Taschenkonturen pro Operation
- Klick im Viewport toggelt ein Ziel in/aus der Auswahl
- bestehendes `contourId` bleibt als rückwärtskompatibles Primärziel erhalten
- `contourIds[]` ist die explizite Mehrfachauswahl
- alte Projektdateien mit ausschließlich `contourId` bleiben gültig

STEP-Auswahl bleibt in 006B unverändert.

## Motion-Truth

Die einzelnen Ziele werden mit den bereits freigegebenen Single-Target-Builders erzeugt und anschließend **vor** 004T zu einem operationseigenen Canonical Toolpath zusammengeführt.

Damit gilt weiterhin:

> Inspector Motion Truth = Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth.

Der Postprozessor kennt keine Multi-Target-Sonderlogik. 004T materialisiert erst nach der Aggregation die sicheren XYZ-Übergänge zwischen den Runs.

## Fail-closed Grenzen

- Ein fehlerhaftes Ziel sperrt die gesamte Operation; es gibt keinen partiellen NC-Export.
- Aufgebrochene DXF-Konturen plus Mehrfachauswahl sind in 006B nicht freigegeben.
- Restmaterialbearbeitung plus DXF-Taschen-Mehrfachauswahl ist in 006B nicht freigegeben. Single-Target-Restmaterial bleibt unverändert.
- STEP bleibt unverändert.

## Akzeptanz

1. Zwei oder mehr geschlossene DXF-Konturen lassen sich in einer Konturoperation an- und abwählen.
2. Zwei oder mehr geschlossene DXF-Konturen lassen sich in einer Taschenoperation an- und abwählen.
3. Bearbeiten/Preview zeigt alle gewählten Ziele.
4. Prüfen rekonstruiert denselben aggregierten Canonical Toolpath.
5. 004T erzeugt sichere Übergänge zwischen den Ziel-Runs.
6. NC enthält alle Ziele genau einmal innerhalb derselben Operation.
7. Speichern/Öffnen erhält `contourIds[]`; alte Projekte mit nur `contourId` bleiben gültig.
8. Ein Ziel verhält sich wie vor 006B.
