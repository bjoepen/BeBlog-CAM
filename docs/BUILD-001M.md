# BeBlog CAM — Build 001M

## Ziel

001M baut den Workflow-Schritt **03 · Werkzeuge** zu einer eigenständigen, ruhigen Arbeitsfläche aus. Ausgangspunkt bleibt der bewährte Rechner **Drehzahl & Vorschub** aus `bjoepen/beblog-maker-tools`.

Leitfrage:

**Mit welchen nachvollziehbaren Ausgangswerten für Drehzahl und Vorschub kann eine typische Hobby-CNC beginnen — und wie werden daraus wiederverwendbare Werkzeuge für CAM-Bearbeitungen?**

## Gate 11A — Rechenkern aus Maker Tools

Status: **IMPLEMENTIERT / TESTBEREIT**

Der Rechenkern bleibt unverändert und transparent:

`n = (vc × 1000) / (π × d)`

`vf = n × z × fz`

mit Werkzeugdurchmesser `d`, Schnittgeschwindigkeit `vc`, Schneidenzahl `z` und Zahnvorschub `fz`.

Referenztest:

- `d = 6 mm`
- `vc = 200 m/min`
- `z = 2`
- `fz = 0,05 mm`
- Ergebnis ca. `10.610 1/min` und `1.061 mm/min`

## Gate 11B — Hobby-CNC-Empfehlungs-Layer

Status: **UX IMPLEMENTIERT / PRAXISTEST AUSSTEHEND**

Der Werkzeugschritt nutzt die komplette Arbeitsfläche. Maschinenlimits bleiben sichtbar und getrennt vom mathematischen Ausgangswert.

Das Maschinenprofil enthält zunächst:

- maximale Spindeldrehzahl,
- maximalen XY-Vorschub,
- Schnellprofile `12.000`, `18.000`, `24.000` und `30.000 1/min`.

Wird die Drehzahl durch die Maschine begrenzt, bleibt die Zahnlast erhalten:

`vf_begrenzt = n_begrenzt × z × fz`

Danach kann zusätzlich die maximale Vorschubgeschwindigkeit begrenzen.

Die Oberfläche zeigt deshalb getrennt:

- rechnerische Werte,
- reale Maschinenbegrenzung,
- empfohlene Einstellungen,
- den konkreten Grund einer Begrenzung.

Es gibt keinen stillen Sicherheitsfaktor und keine versteckte Materialkorrektur.

Die Material-Schnellwahl bleibt in 001M bewusst ohne automatische Schnittwerte. Material-Presets folgen erst nach dokumentierter Datenbasis.

## Gate 11C — Werkzeugdaten und Werkzeugbibliothek

Status: **TEIL 1 IMPLEMENTIERT / TESTBEREIT**

Die drei Werkzeug-Tabs sind jetzt echte Zustände statt rein visueller Platzhalter:

1. **Werkzeugdaten**
2. **Drehzahl & Vorschub**
3. **Werkzeugbibliothek**

### Werkzeugdaten

Ein Werkzeug besitzt im aktuellen Gate:

- frei vergebenen Namen,
- Werkzeugdurchmesser,
- Schneidenzahl,
- Zahnvorschub.

Der Nutzer kann ein neues Werkzeug anlegen oder ein aus der Bibliothek geladenes Werkzeug aktualisieren.

### Drehzahl & Vorschub

Der Rechenkern ist nun als eigener Werkzeug-Tab organisiert. Werkzeugdaten und Maschinenprofil bleiben sichtbar getrennt.

Der Tab zeigt:

- Schnittgeschwindigkeit,
- Zahnvorschub,
- rechnerische Drehzahl und Vorschub,
- begrenzte Werte für das Maschinenprofil,
- aktive Werkzeugdaten,
- Material-Schnellwahl weiterhin ohne versteckte Presets.

### Werkzeugbibliothek

Werkzeuge können lokal gespeichert, wieder geladen, bearbeitet und gelöscht werden.

Persistenz:

`localStorage` unter Version-Key `beblog-cam.tool-library.v1`.

Damit ist die Bibliothek bewusst lokal und benötigt weder Cloud noch Account.

Gespeichert werden ausschließlich Werkzeugdaten. Material- und Maschinenwerte werden nicht in ein Werkzeug eingebrannt, damit die Bibliothek nicht unbemerkt Maschinen- oder Materialannahmen transportiert.

### Scope-Grenze 11C Teil 1

Noch **nicht** umgesetzt ist die verbindliche Übergabe eines Bibliothekswerkzeugs samt bestätigter Schnittdaten in die aktive CAM-Bearbeitung.

Dieser Übergabepunkt wird als eigener zweiter Teil von Gate 11C umgesetzt und getestet. Ziel ist:

**Werkzeug auswählen → Schnittdaten bestätigen → aktive Bearbeitung übernimmt Werkzeug, Drehzahl und Vorschub sichtbar und explizit.**

Die Übergabe darf bestehende Bearbeitungen nicht still verändern und benötigt daher einen eigenen Test.

## CNC-Floh

Der CNC-Floh wird künftig als separates finales Asset behandelt. Die Werkzeuglogik darf nicht von seiner Illustration oder Position abhängen.

## Sicherheitsprinzip

Ein Schnittdatenrechner liefert **Startwerte, keine Garantie**. Werkzeugherstellerangaben, Material, Auskragung, Maschinensteifigkeit, Spindelleistung, Spanabfuhr und Aufspannung bleiben reale Grenzen.

## Bezug zu 001L

001L bleibt parallel auf **SEMI-PASS**, bis der reale Estlcam-Maschinenlauf erfolgt und die reale Fräsgeometrie geprüft wurde.

001M verändert keine bewiesenen Werkzeugwege und keinen Postprozessor aus 001L.
