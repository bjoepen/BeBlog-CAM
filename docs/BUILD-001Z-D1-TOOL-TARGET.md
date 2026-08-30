# 001Z-D1 — Werkzeugdaten gezielt einer Bearbeitung zuweisen

## Problem

Der Werkzeugbereich schrieb Werkzeug und berechnete Schnittdaten bisher implizit in die gerade aktive CAM-Bearbeitung.

Damit war der Workflow nur dann eindeutig, wenn der Nutzer vorher bewusst in `Bearbeiten` die richtige Operation aktiviert hatte.

## Lösung

`Werkzeuge` besitzt jetzt eine explizite **Zielbearbeitung**.

- Beim Öffnen von `Werkzeuge` wird die aktuell aktive Bearbeitung vorausgewählt.
- Der Nutzer kann dort jede vorhandene Bearbeitung als Ziel wählen.
- Werkzeug- und Schnittdaten werden nur in diese Zielbearbeitung geschrieben.
- Die aktive Bearbeitung im Schritt `Bearbeiten` wird dadurch nicht automatisch gewechselt.
- Ist die Zielbearbeitung zugleich aktiv, wird auch der lokale aktive Operation-State aktualisiert.
- Die Operation bleibt weiterhin Eigentümer ihrer Werkzeug- und Schnittdaten.

## UX-Regel

`Aktive Bearbeitung` und `Zielbearbeitung für Werkzeugdaten` sind zwei verschiedene Zustände.

Der Werkzeugbereich zeigt deshalb explizit:

`Schnittdaten für Bearbeitung → 03 · Tasche`

und der Transferbutton benennt sein Ziel.

## Nächster Schritt

001Z-D2 führt Face-Target Z-Level Roughing als echte `CamOperation` ein. Dadurch erscheint auch die 3D-Bearbeitung automatisch in diesem Zielbearbeitungs-Selector.
