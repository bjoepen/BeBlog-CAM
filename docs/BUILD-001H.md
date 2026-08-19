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

Der Realtest bestätigte nach dem Importmodell-Umbau:

- Anwendung startet normal,
- CBG-DXF wird weiterhin korrekt dargestellt,
- bestehende DXF-Darstellung ist nicht regressiert,
- offene Bundschlitz-Linien bleiben erwartungsgemäß noch nicht über den alten geschlossenen Konturpicker auswählbar.

Damit ist die buildneutrale Import-/Datenmodellstufe bestanden.

**Gate 6A = PASS.**

## Gate 6B — Carve-Auswahl und UX

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

`CarveOperation` ist nun Teil der aktiven CAM-Operationen. Unter `04 · Bearbeiten` stehen weiterhin innerhalb desselben linearen Arbeitsschritts drei Bearbeitungsarten:

`Kontur | Tasche | Carve`

Es entsteht ausdrücklich kein neuer linker Workflow-Schritt.

### Auswahlmethoden

Carve besitzt zwei kontextuelle Auswahlmethoden:

- **Einzeln** — offene DXF-Geometrien können im Viewport an- und abgewählt werden.
- **Ebene** — alle unterstützten offenen Geometrien eines DXF-Layers werden gemeinsam ausgewählt.

Die Ebenenauswahl zeigt ausschließlich Layer, die mindestens eine aktuell unterstützte offene Carve-Geometrie enthalten. Gate 6B unterstützt dafür:

- `LINE`,
- `ARC`,
- offene `LWPOLYLINE`.

Geschlossene Konturen werden in diesem Gate weiterhin über Kontur/Tasche bearbeitet und nicht automatisch als Carve-Ziel interpretiert.

Für das CBG-Referenzmodell soll die Wahl `Ebene → FRET_SLOTS` alle 17 Bundschlitze in einer einzigen Carve-Operation auswählen.

### Viewport-Regel

Bei Carve ist die ausgewählte CAD-Geometrie bereits die Werkzeugmittellinie. Deshalb gibt es bewusst:

- keinen Radiusoffset,
- keine zweite versetzte Werkzeugbahn,
- keinen dicken sichtbaren Balken über der Geometrie.

Die ausgewählten offenen Linien werden lediglich dünn und eindeutig hervorgehoben. Eine breitere unsichtbare Hit-Zone dient nur der Mausauswahl und verändert die sichtbare Geometrie nicht.

### Sicherheitsgrenze

`05 · Prüfen` und `06 · Fräsen` bleiben für Carve in Gate 6B bewusst gesperrt. Auswahl und UX werden zuerst real geprüft; erst Gate 6C erhält mathematischen Centerline-Preflight und Maschinen-Code.

### Gate-6B-Realtest

Für PASS sind erforderlich:

1. CBG-DXF laden.
2. Unter `04 · Bearbeiten` `Carve` wählen.
3. `Einzeln` testen: einzelne Bundschlitze müssen unabhängig wählbar und wieder abwählbar sein.
4. `Ebene` wählen und `FRET_SLOTS` auswählen.
5. Es müssen alle 17 Bundschlitze gemeinsam hervorgehoben und als 17 ausgewählte offene Geometrien gemeldet werden.
6. Die sichtbare Carve-Linie muss exakt auf der DXF-Linie liegen; kein Werkzeugradiusversatz und keine überbreite sichtbare Auswahlmarkierung.
7. Kontur- und Taschenauswahl dürfen durch die Erweiterung nicht regressieren.

## Gate 6C — als Nächstes

Nach bestandenem Gate 6B folgt:

- nur unterstützte offene Geometrien freigeben,
- exakte Centerline-Koordinaten prüfen,
- Z-Zustellungen und Schnittdaten prüfen,
- mehrere Segmente sicher anfahren,
- `.nc`-Export.

Danach folgt Gate 6D mit Verfahrreihenfolge und CAMotics-Regression am CBG-Griffbrett.
