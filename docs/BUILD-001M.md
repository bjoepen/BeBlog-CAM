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

Status: **TEIL 1 PASS / TEIL 2 IMPLEMENTIERT / TESTBEREIT**

Die drei Werkzeug-Tabs sind echte Zustände:

1. **Werkzeugdaten**
2. **Drehzahl & Vorschub**
3. **Werkzeugbibliothek**

### Teil 1 — Werkzeugdaten und Bibliothek

Ein Werkzeug besitzt im aktuellen Gate:

- frei vergebenen Namen,
- Werkzeugdurchmesser,
- Schneidenzahl,
- Zahnvorschub.

Werkzeuge können lokal gespeichert, wieder geladen, bearbeitet und gelöscht werden.

Persistenz:

`localStorage` unter Version-Key `beblog-cam.tool-library.v1`.

Gespeichert werden ausschließlich Werkzeugdaten. Material- und Maschinenwerte werden nicht in ein Werkzeug eingebrannt.

Das Werkzeugformular ist gegen Selbstüberlagerung geschützt und bricht bei geringerer Fensterbreite kontrolliert responsiv um.

### Teil 2 — Explizite Übergabe in die aktive CAM-Bearbeitung

Die Übergabe ist jetzt implementiert und muss als eigener Real-World-/UI-Test bestätigt werden.

Im Tab **Drehzahl & Vorschub** gibt es einen expliziten Button:

**Werkzeug & Schnittdaten übernehmen**

Erst dieser Button verändert die aktive CAM-Bearbeitung. Das bloße Laden oder Auswählen eines Bibliothekswerkzeugs bleibt folgenlos für bestehende Operationen.

Übernommen werden ausschließlich:

- Werkzeug-ID und Werkzeugname,
- Werkzeugdurchmesser,
- empfohlene bzw. durch das Maschinenprofil begrenzte Spindeldrehzahl,
- dazu passend berechneter Vorschub.

Bewusst **nicht** verändert werden:

- Gesamttiefe,
- Zustellung,
- Eintauchvorschub,
- Sicherheits-Z,
- operationsspezifische Geometrie- und Strategiewerte.

Nach der Übergabe zeigt der Werkzeug-Tab eine sichtbare Bestätigung mit Zieloperation und den übernommenen Werten.

### Testziel Teil 2

1. Eine CAM-Operation als aktiv wählen.
2. Unter **Werkzeuge → Drehzahl & Vorschub** Werkzeug und Maschinenprofil einstellen.
3. Vor dem Übernehmen die Werte der aktiven Operation unter **Bearbeiten** notieren.
4. **Werkzeug & Schnittdaten übernehmen** auslösen.
5. Unter **Bearbeiten** prüfen:
   - Werkzeugdurchmesser wurde übernommen,
   - Vorschub wurde übernommen,
   - Drehzahl wurde übernommen,
   - Tiefe, Zustellung, Eintauchvorschub und Sicherheits-Z sind unverändert.
6. Bei mehreren Operationen sicherstellen, dass ausschließlich die zum Zeitpunkt der Übergabe aktive Operation geändert wurde.

## CNC-Floh

Der CNC-Floh wird künftig als separates finales Asset behandelt. Die Werkzeuglogik darf nicht von seiner Illustration oder Position abhängen.

## Sicherheitsprinzip

Ein Schnittdatenrechner liefert **Startwerte, keine Garantie**. Werkzeugherstellerangaben, Material, Auskragung, Maschinensteifigkeit, Spindelleistung, Spanabfuhr und Aufspannung bleiben reale Grenzen.

## Bezug zu 001L

001L bleibt parallel auf **SEMI-PASS**, bis der reale Estlcam-Maschinenlauf erfolgt und die reale Fräsgeometrie geprüft wurde.

001M verändert keine bewiesenen Werkzeugwege und keinen Postprozessor aus 001L.
