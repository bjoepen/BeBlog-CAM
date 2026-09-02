# 001Z-D2 — Z-Level Schruppen als echte CamOperation

## Ziel

Face-Target Z-Level Roughing ist kein Viewport-Sondermodus mehr.

Die Bearbeitung besitzt jetzt dieselben Kernfelder wie die übrigen CAM-Operationen:

- Werkzeug
- Werkzeugdurchmesser
- Zustellung
- Vorschub
- Eintauchvorschub
- Drehzahl
- Sicherheits-Z

Zusätzlich besitzt sie ihre 3D-spezifischen Parameter:

- Stepover
- Schlichtaufmaß

## Semantik

`Z-Level Schruppen` entfernt Material oberhalb einer ausgewählten horizontalen STEP/BRep-Zielfläche bis zum definierten Schlichtaufmaß.

Die Zielhöhe stammt aus der Geometrie. Deshalb besitzt die Operation keine manuell eingegebene Gesamttiefe.

## Workflow

`Werkzeuge → Zielbearbeitung Z-Level Schruppen → Werkzeug/Schnittdaten übernehmen`

`Bearbeiten → Z-Level Schruppen → Zustellung / Stepover / Schlichtaufmaß`

`STEP-Viewport → Zielfläche wählen`

`Prüfen / Fräsen → derselbe kanonische Face-Target-Toolpath`

## D2-Grenze

Die ausgewählten BRep-Face-IDs leben noch im Viewport-State. Das wird in D3 in die Operation verlagert.

## Werkzeugfreigaben

D2 führt noch keine neue Capability-Matrix ein. Die zentrale Werkzeug/Bearbeitungsverfahrens-Freigabe folgt separat in D2b.
