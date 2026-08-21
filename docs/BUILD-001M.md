# BeBlog CAM — Build 001M

## Ziel

001M baut den Workflow-Schritt **03 · Werkzeuge** zu einer eigenständigen, ruhigen Arbeitsfläche aus. Ausgangspunkt bleibt der bewährte Rechner **Drehzahl & Vorschub** aus `bjoepen/beblog-maker-tools`.

Leitfrage:

**Mit welchen nachvollziehbaren Ausgangswerten für Drehzahl und Vorschub kann eine typische Hobby-CNC beginnen — und welche Maschinenlimits begrenzen diese Werte tatsächlich?**

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

Status: **GESTARTET / UX IMPLEMENTIERT / PRAXISTEST AUSSTEHEND**

### Freigegebenes Dashboard-Layout

Der Werkzeugschritt nutzt jetzt die breite Arbeitsfläche statt des schmalen Inspectors. Die Gestaltung folgt dem freigegebenen Dashboard-Entwurf:

- große Überschrift `Drehzahl & Vorschub`,
- vier ruhige Eingabefelder in einer Zeile,
- hervorgehobene resultierende Drehzahl und Vorschubwerte,
- eigene rechte Spalte für berechnete Werte, Maschinenprofil und Empfehlungen,
- schnelle Spindelprofile,
- Schnitttipps und Material-Schnellwahl,
- Formeln nur bei Bedarf aufklappbar,
- CNC-Floh mit dem Satz `Klarheit schafft präzise Späne.` als ruhiger Abschluss.

### Maschinenprofil

Das Maschinenprofil ist optional und sichtbar schaltbar. Es enthält zunächst:

- maximale Spindeldrehzahl,
- maximalen XY-Vorschub.

Schnelle Spindelprofile:

- `12.000 1/min`,
- `18.000 1/min`,
- `24.000 1/min`,
- freie Eingabe bleibt möglich.

Damit werden auch typische Hobby-Spindeln berücksichtigt, die die theoretisch berechnete Drehzahl nicht erreichen.

### Transparente Begrenzung

Der mathematische Ausgangswert bleibt immer sichtbar. Wird die Drehzahl durch das Maschinenprofil begrenzt, berechnet BeBlog CAM den Vorschub mit derselben Zahnlast neu:

`vf_begrenzt = n_begrenzt × z × fz`

Danach wird optional noch die definierte maximale Vorschubgeschwindigkeit berücksichtigt.

Die Oberfläche zeigt deshalb getrennt:

- **Berechnete Werte**,
- **Empfohlene Einstellungen**,
- den konkreten Grund einer Begrenzung.

Es gibt keinen stillen Sicherheitsfaktor und keine versteckte Materialkorrektur.

### Material-Schnellwahl

Die Material-Schaltflächen sind bereits Teil der freigegebenen UX, verändern in diesem Gate jedoch bewusst noch keine Schnittdaten. Material-Presets folgen erst nach einer dokumentierten und überprüften Datenbasis.

## Sicherheitsprinzip

Ein Schnittdatenrechner liefert **Startwerte, keine Garantie**. Werkzeugherstellerangaben, Material, Auskragung, Maschinensteifigkeit, Spindelleistung, Spanabfuhr und Aufspannung bleiben reale Grenzen.

## Bezug zu 001L

001L bleibt parallel auf **SEMI-PASS**, bis der reale Estlcam-Maschinenlauf erfolgt und die reale Fräsgeometrie geprüft wurde.

001M verändert keine bewiesenen Werkzeugwege und keinen Postprozessor aus 001L.
