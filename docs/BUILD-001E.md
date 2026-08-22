# Build 001E — Setup-Fundament

## Status

PASS — 001E erweitert den stabilen 001D-Setup-Workflow um Modellorientierung, flexible Rohlingmodi und DXF ohne Rohling.

## Verbindliche Setup-Logik

Die CAM-Sicht trennt bewusst vier Dinge:

1. **Kameraorientierung** — reine Ansicht, verändert die CAM-Geometrie nicht.
2. **Modellorientierung** — echte Rotation des Bauteils relativ zu Rohling und WCS.
3. **Bauteilposition im Rohling** — geplante Lage der Geometrie im Material.
4. **WCS / Werkstücknullpunkt** — der Punkt, der später am realen Werkstück angetastet wird.

Maschinenkoordinaten gehören nicht zum CAM-Setup. Sie entstehen an der Maschine durch Referenzfahrt/Homing.

## Gate-Ergebnisse

### Gate 1 — Modellorientierung

PASS.

- Z-Rotation 0°, 90°, 180°, 270°
- freie Z-Rotation
- STEP und DXF
- Modellrotation ist unabhängig von Kamera-Orbit
- Bauteilpositionierung wird nach Rotation neu aus den orientierten Grenzen bestimmt

### Gate 2 — Bauteil = Rohling

PASS.

- manueller Rohling bleibt verfügbar
- STEP: Breite, Länge und Dicke werden aus orientierten Bauteilgrenzen übernommen
- DXF: Breite und Länge aus Geometrie, Materialdicke bleibt separat
- Rohling folgt einer nachträglichen Modellrotation automatisch

### Gate 3 — DXF ohne Rohling

PASS.

- nur für DXF sichtbar
- kein künstlicher Stock-Rahmen
- DXF wird auf ihre orientierten Bauteilgrenzen normalisiert
- WCS bleibt sichtbar
- ein Rohling wird erst dann zwingend, wenn eine spätere Bearbeitungsstrategie Materialgrenzen benötigt

### Gate 4 — WCS-Verhalten

PASS im aktuellen Setup-Modell.

Der aktuelle WCS auf Bauteilgeometrie basiert auf den **orientierten Bauteilgrenzen / Bounding Box**. Bei unserer Referenz-DXF wirkt der Nullpunkt dadurch so, als läge er im Schnittpunkt der Verlängerungen zweier Geraden. Das ist derzeit jedoch **keine explizite geometrische Linien-Schnittpunkt-Erkennung**.

Diese Unterscheidung ist verbindlich zu dokumentieren.

## Geplante WCS-Erweiterungen

Später können zusätzliche echte geometrische Referenzen ergänzt werden, insbesondere:

- Schnittpunkt verlängerter Geraden
- vorhandener Eckpunkt
- Kreismittelpunkt
- explizit ausgewählter Punkt

Diese Erweiterungen ersetzen nicht die robuste Bounding-Box-Referenz, sondern ergänzen sie.

## Mehrere Aufspannungen

Die UI zeigt weiterhin bewusst nur den einfachen Hobby-CNC-Fall mit einer Aufspannung. Das Datenmodell ist jedoch bereits so vorbereitet, dass später mehrere Setups möglich sind.

Zielhierarchie:

`Projekt → Bauteil → Rohling → Aufspannung(en) → WCS → Operationen`

Eine spätere Zweitseitenbearbeitung erhält damit pro Aufspannung eigene Orientierung, eigenen WCS und eigene Bearbeitungsoperationen. Werkstückwenden, Referenzbohrungen/Passstifte und Setup-Wechsel sind zukünftige Funktionen und noch nicht Teil von 001E.

## Regression

Folgende Funktionen müssen bei allen Folge-Builds erhalten bleiben:

- STEP-Import
- DXF-Import
- Orbit
- Mausrad-Zoom
- Zoom + / −
- Reset
- Rohling live ändern
- Bauteil live positionieren
- X/Y/Z-Feinkorrektur
- WCS sichtbar und live
- Modellorientierung
- Bauteil = Rohling
- DXF ohne Rohling

Insbesondere der funktionierende Pointer-/Mausrad-Mechanismus des Viewports darf nicht beiläufig refaktoriert werden.

## Nächster Schritt

001F beginnt mit der Operationsarchitektur und der ersten echten Bearbeitungsoperation. Ziel ist nicht sofort vollständiger G-Code, sondern zunächst eine klare, visuell prüfbare Operation mit Werkzeug, Tiefe, Sicherheitsabstand und Werkzeugwegvorschau.