# BeBlog CAM 001V — Helical Bore Milling

## Ziel

001V erweitert den bestehenden Bohr-Workflow um ein zweites Herstellungsverfahren, ohne eine parallele CAM-Welt aufzubauen.

**Eine Bohrung bleibt eine Bohrbearbeitung.** Der Nutzer wählt dieselben DXF-Kreise und entscheidet anschließend, wie die Bohrung hergestellt wird:

- **Bohren** — axiale G0/G1-Bewegungen wie bisher
- **Helixfräsen** — Kreisinterpolation mit kleinerem Schaftfräser

## Datenmodell

`DrillOperation` besitzt ab 001V das Feld:

```ts
method: 'drill' | 'helical-mill'
```

Auswahl, Layer-Logik, Tiefe, Werkzeug, Schnittdaten, WCS, Preflight und Postprozessor-Pipeline bleiben gemeinsam.

## Helixgeometrie

Der native DXF-Kreis definiert Mittelpunkt und Soll-Durchmesser. Für Helixfräsen wird der Fräsermittelbahnradius analytisch berechnet:

`rBahn = (DBohrung - DWerkzeug) / 2`

Voraussetzungen:

- Werkzeugtyp: Schaftfräser
- Werkzeugdurchmesser > 0
- Werkzeugdurchmesser < Bohrungsdurchmesser
- positiver Helixbahnradius
- Helix-Zustellung pro Umdrehung > 0
- Z-Null auf Rohlingoberseite

## Maschinenpfad

001V verwendet portable, native Halbkreise statt controllerabhängiger Bohrzyklen oder Vollkreise:

1. Safe-Z
2. G0 zum Tangentialpunkt der Fräsermittelbahn
3. G1 bis Z0 mit Eintauchvorschub
4. je Umdrehung zwei G3-Halbkreise mit simultaner Z-Zustellung
5. letzter Teilumlauf endet exakt auf Solltiefe
6. vollständiger Fertigumlauf auf Endtiefe
7. Rückzug auf Safe-Z

Damit bleiben I/J relative Kreismittelpunkte und absolute XYZ-Koordinaten kompatibel zur bestehenden Postprozessor-Pipeline.

## Preflight

Der bestehende Bohr-Preflight prüft beide Verfahren. Helixfräsen ergänzt insbesondere:

- Schaftfräser erforderlich
- Werkzeug muss kleiner als jede ausgewählte Bohrung sein
- positiver Fräsermittelbahnradius
- gültige Helix-Zustellung
- WCS-Z weiterhin nur Oberseite

Der Gesamtjob-Preflight verwendet dieselbe Prüfung; es entsteht kein zweiter Validator.

## Nicht Bestandteil von 001V

- G81/G83 oder andere controllerabhängige Canned Cycles
- Peck-Drilling
- STEP-basierte Bohrungsselektion
- allgemeine Werkzeug–Operation-Kompatibilitätsmatrix (001W)
- Z-Level Roughing
- Stock Simulation

## Gates

### V1 — Regression Bohren

- vorhandene DXF-Kreise auswählen
- Verfahren `Bohren`
- Preflight PASS
- bestehender axialer G0/G1-Pfad bleibt funktional

### V2 — Helixauswahl

- dieselbe Bohrbearbeitung auf `Helixfräsen` umstellen
- keine neue Operation oder parallele Geometrieauswahl erforderlich
- UI zeigt Helix-Zustellung pro Umdrehung

### V3 — Werkzeugübernahme

- Schaftfräser aus `Werkzeuge` übernehmen
- Durchmesser, Vorschub und Drehzahl erscheinen in derselben Bohr-Operation

### V4 — Geometrieprüfung

- Fräser Ø kleiner als Bohrungs-Ø: freigabefähig
- Fräser Ø gleich/größer Bohrungs-Ø: FAIL
- Vollradius-, Plan- und V-Fräser: FAIL für Helixfräsen

### V5 — Helix-G-Code

Für eine bekannte Kreisbohrung prüfen:

- Start auf Safe-Z
- XY-Anfahrt nur außerhalb des Materials bzw. auf Safe-Z
- G1 bis Z0
- G3-Halbkreise mit I/J und Z
- Endtiefe exakt erreicht
- Fertigumlauf ohne weitere Z-Zustellung
- Rückzug auf Safe-Z
- M5/M30 sauber

### V6 — Postprozessoren

- LinuxCNC PASS
- GRBL PASS
- Estlcam darf den vorhandenen G2/G3-Subset nicht beschädigen

### V7 — Gesamtjob

- Bohren und Helixfräsen können gemeinsam mit Planen, Kontur, Tasche und Carve im Operationsprojekt stehen
- Gesamtjob-Preflight nutzt den vorhandenen gemeinsamen Validator
- Werkzeugwechsel bleiben korrekt

### V8 — Regression

- Bauteil öffnen
- Rohling + Werkstoff
- Werkzeugbibliothek
- Planen
- Kontur
- Tasche
- Carve
- Bohren
- Prüfen
- Fräsen/Postprozessoren
- CNC-Floh

## Lokale Gates

```bash
pnpm check
pnpm build
pnpm tauri dev
```

001V ist erst mergefähig, wenn die technischen Gates und V1–V8 PASS sind.
