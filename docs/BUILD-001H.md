# BeBlog CAM — Build 001H

## Ziel

001H erweitert den bewiesenen 2D-CAM-Kern schrittweise, ohne bestehende PASS-Pfade zu verändern.

## Gates 1–5

**PASS / GESCHLOSSEN.** Rechtecktasche, Preflight, `.nc`, CAMotics, optimierter Wandumlauf sowie senkrechte und analytisch geprüfte lineare Rampenzustellung sind verifiziert.

Freigegebener Taschenpfad:

`DXF-Sollkontur → radiuskorrigierte Taschenfläche → Rasterstrategie → Preflight → Senkrecht ODER geprüfte Rampe → Z-Zustellungen → Wandumlauf → .nc → CAMotics`

## Gate 6 — Carve / Mittellinienbearbeitung

Referenzbauteil ist das reale CBG-Griffbrett `CBG_Diatonic_3_String_635mm.dxf`. Die Bundschlitze liegen als einzelne offene Linien auf dem DXF-Layer `FRET_SLOTS` und werden später mit einem Ø 0,6-mm-Fräser bearbeitet. Die Außenkontur bleibt eine separate Konturoperation.

### Verbindliche Semantik

- **Kontur:** CAD-Geometrie beschreibt die fertige Werkstückkante; Fräsermittelbahn wird radiuskorrigiert.
- **Tasche:** CAD-Geometrie beschreibt die fertige Flächenbegrenzung; der Innenraum wird radiuskorrigiert geräumt.
- **Carve:** CAD-Geometrie **ist die Fräsermittellinie**. Es gibt keinen seitlichen Werkzeugradius-Offset.

Damit bleibt die bestehende Grundregel erhalten: Die CAD-Koordinaten sind maßgeblich; die Operation bestimmt lediglich ihre Bearbeitungssemantik.

## Gate 6A — DXF-Layer als CAM-Semantik

Status: **PASS / GESCHLOSSEN**

Der DXF-Importer verwirft Layerinformationen nicht mehr. Für jede importierte Kurve wird parallel der originale DXF-Layer gespeichert; zusätzlich liefert `PlanarGeometry` die tatsächlich verwendeten Layernamen.

Neue Felder:

- `planarGeometry.curveLayers[]` — 1:1-Zuordnung zu `curves[]`
- `planarGeometry.layerNames[]` — eindeutige verwendete Layer

Der Realtest bestätigte Anwendungstart, korrekte DXF-Darstellung und keine Regression des bestehenden Importpfads.

**Gate 6A = PASS.**

## Gate 6B — Carve-Auswahl und UX

Status: **PASS / GESCHLOSSEN**

Unter `04 · Bearbeiten` stehen innerhalb desselben linearen Arbeitsschritts:

`Kontur | Tasche | Carve`

Carve unterstützt die Auswahlmethoden `Einzeln` und `Ebene`. Die Ebenenwahl ist ausdrücklich nur eine komfortable Vorauswahl. Maßgeblich für die Bearbeitung bleibt immer die konkrete Liste `curveIds[]`.

Verbindliche Regel:

**Ebene = Vorauswahl. Konkrete Geometrieauswahl = verbindliche Bearbeitungsmenge.**

Der Realtest am CBG-Griffbrett bestätigte:

- Ebene `FRET_SLOTS` kann gemeinsam ausgewählt werden,
- alle zugehörigen offenen Geometrien werden hervorgehoben,
- einzelne Elemente können anschließend direkt im Viewport aus der Ebenenauswahl entfernt werden,
- erneuter Klick fügt sie wieder hinzu,
- der Nullbund kann damit gezielt ausgeschlossen werden,
- die Anzeige wechselt entsprechend von der vollständigen Ebenenauswahl auf die reduzierte konkrete Auswahl,
- die sichtbare Carve-Bahn bleibt exakt auf der DXF-Centerline; kein Radiusoffset und kein sichtbarer dicker Balken.

**Gate 6B = PASS.**

## Gate 6C — mathematischer Carve-Preflight

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

Gate 6C schaltet `05 · Prüfen` für Carve frei. Maschinen-Code bleibt weiterhin gesperrt.

Der pure Prüfkernel liegt in `src/lib/carveMath.ts`; die sichtbare Preflight-UX in `src/lib/CarvePreflightPanel.svelte`.

### Prüfregeln

Der Preflight prüft:

- mindestens eine konkret ausgewählte Geometrie,
- keine doppelten Geometrie-IDs,
- alle ausgewählten IDs existieren noch in der aktuellen DXF,
- nutzbare geometrische Länge,
- Werkzeugdurchmesser > 0,
- Gesamttiefe > 0,
- Zustellung > 0,
- Vorschub / Eintauchvorschub / Drehzahl > 0,
- Sicherheits-Z > 0,
- resultierende Zahl der Z-Zustellungen,
- Gesamt-Centerline-Länge der ausgewählten Carve-Geometrien.

### Centerline-Wahrheit

Für Carve gilt im Preflight ausdrücklich:

`Soll = Ist = ausgewählte DXF-Geometrie`

Seitlicher Werkzeugradius-Offset:

`0.000 mm`

Die Werkzeugbreite beeinflusst die reale Nutbreite, aber nicht die XY-Fräsermittellinie.

### Bewusste Gate-6C-Grenze

Der erste mathematisch freigegebene Carve-Referenzpfad akzeptiert zunächst ausschließlich exakte offene DXF-`LINE`-Entities. `ARC` und offene `LWPOLYLINE` bleiben in der Auswahl sichtbar, führen in Gate 6C aber bewusst zu FAIL, bis deren native Carve-Interpolation separat regression-getestet ist.

Damit ist der CBG-Bundschlitzfall maximal transparent und mathematisch auditierbar.

### Gate-6C-Realtest

Für PASS sind erforderlich:

1. CBG-DXF laden.
2. `Carve → Ebene → FRET_SLOTS` wählen.
3. Nullbund abwählen, sodass nur die gewünschten Bundschlitze verbleiben.
4. `05 · Prüfen` öffnen.
5. Preflight muss die konkrete Anzahl ausgewählter Linien, gesamte Centerline-Länge, Werkzeug Ø 0,6 mm, Tiefe/Zustellungen und Schnittdaten anzeigen.
6. Seitlicher Offset muss explizit `0.000 mm` sein.
7. `05 · Prüfen` muss bei gültigen Parametern PASS liefern.
8. Negativtest: Auswahl vollständig leeren oder eine nicht freigegebene Geometrie hinzufügen → FAIL.

Erst nach diesem Realtest folgt der Carve-G-Code mit sicherer Mehrsegment-Anfahrt und `.nc`-Export.
