# Build 004J — Explizite STEP-Geometrieauswahl

## Ziel
Kein STEP-Werkzeugweg darf mehr aus einer stillen automatischen Geometriewahl entstehen.

## Sicherheitsvertrag
- Kontur: `stepWireId` muss explizit gewählt sein.
- Tasche: `stepFaceId` muss explizit gewählt sein.
- Bohren/Helix: `stepHoleFeatureIds` muss mindestens eine explizit gewählte erkannte Bohrung enthalten.
- Fehlende oder veraltete Auswahl führt fail-closed zu keinem Toolpath.

## Viewport
- Taschen werden über planare BRep-Faces gewählt.
- Bohrungen werden über die konservativ erkannten zylindrischen Hole-Faces gewählt; Mehrfachauswahl ist möglich.
- Konturen werden über BRep-Kanten gewählt. Eine Kante ist nur anklickbar, wenn sie eindeutig genau einer gültigen geschlossenen Kontur-Wire zugeordnet werden kann.

## Ergebnis
Die bisherige Übergangslogik „größte obere Wire“, „obere innere Face“ bzw. „alle erkannten Bohrungen“ ist nicht mehr produktionswirksam.
