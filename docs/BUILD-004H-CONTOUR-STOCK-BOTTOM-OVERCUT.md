# Build 004H — Kontur bis Rohlingunterseite + Overcut

## Ziel

Konturen dürfen nicht nur eine frei eingegebene Gesamttiefe verwenden. Für reale Trennschnitte braucht BeBlog CAM einen eindeutigen Bezug zur Rohlingunterseite sowie ein optionales Übermaß in die Opferplatte.

Beispiel: Rohling 18 mm, Overcut 1 mm, Z-Null oben → End-Z = -19 mm.

## Vertrag

`ContourOperation.depthMode` kennt:

- `manual` — bisherige `totalDepthMm` bleibt maßgeblich.
- `stock-bottom` — effektive Tiefe = `stock.thickness + overcutMm`.

`overcutMm` ist positiv gespeichert, obwohl der resultierende Maschinen-Z-Wert unterhalb der Rohlingunterseite negativ wird.

## Gemeinsame Wahrheit

DXF- und STEP-Konturen verwenden denselben `resolveContourDepth()`-Vertrag. Es gibt keine getrennte Tiefenlogik pro Importformat.

## Fail closed

Stock-bottom wird gesperrt bei:

- keinem definierten Rohling,
- WCS-Z nicht auf Oberseite,
- ungültiger/fehlender Rohlingdicke,
- negativem oder ungültigem Overcut.

Overcut > 2 mm erzeugt zusätzlich eine Warnung, damit Opferplatte und Spannmittel bewusst geprüft werden.

## Rückwärtskompatibilität

Fehlt `depthMode` in alten Projekten, gilt `manual`. Der Default bleibt `manual` mit `overcutMm: 0`. Bestehende Jobs verändern sich dadurch nicht.

## Noch offen

Die Maschinen-/Canonical-Pfade unterstützen 004H vollständig. Die sichtbare Bearbeiten-UI für den neuen Tiefenmodus wird als unmittelbar folgender UX-Anschluss ergänzt; Haltestege/Tabs bleiben der nächste Fertigungsbuild.

## Gates

- `pnpm check:004a` … `pnpm check:004h`
- `pnpm check`
- `pnpm build`

Kein nativer OCCT-Test erforderlich; 004H verändert die BRep-Bridge nicht.
