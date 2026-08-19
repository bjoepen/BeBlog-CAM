# BeBlog CAM — Build 001H

## Ziel

001H erweitert den bewiesenen 2D-CAM-Kern schrittweise, ohne bestehende PASS-Pfade zu verändern.

## Gates 1–5

**PASS / GESCHLOSSEN.** Rechtecktasche, Preflight, `.nc`, CAMotics, optimierter Wandumlauf sowie senkrechte und analytisch geprüfte lineare Rampenzustellung sind verifiziert.

Freigegebener Taschenpfad:

`DXF-Sollkontur → radiuskorrigierte Taschenfläche → Rasterstrategie → Preflight → Senkrecht ODER geprüfte Rampe → Z-Zustellungen → Wandumlauf → .nc → CAMotics`

## Gate 6 — Carve / Mittellinienbearbeitung

Status: **6A IMPLEMENTIERT — IMPORT-/DATENMODELL**

Referenzbauteil ist das reale CBG-Griffbrett `CBG_Diatonic_3_String_635mm.dxf`. Die Bundschlitze liegen als einzelne offene Linien auf dem DXF-Layer `FRET_SLOTS` und werden später mit einem Ø 0,6-mm-Fräser bearbeitet. Die Außenkontur bleibt eine separate Konturoperation.

### Verbindliche Semantik

Carve unterscheidet sich bewusst von den bestehenden Operationen:

- **Kontur:** CAD-Geometrie beschreibt die fertige Werkstückkante; Fräsermittelbahn wird radiuskorrigiert.
- **Tasche:** CAD-Geometrie beschreibt die fertige Flächenbegrenzung; der Innenraum wird radiuskorrigiert geräumt.
- **Carve:** CAD-Geometrie **ist die Fräsermittellinie**. Es gibt keinen seitlichen Werkzeugradius-Offset.

Damit bleibt die bestehende Grundregel erhalten: Die CAD-Koordinaten sind maßgeblich; die Operation bestimmt lediglich ihre Bearbeitungssemantik.

### Gate 6A — DXF-Layer als CAM-Semantik

Der DXF-Importer verwirft Layerinformationen nicht mehr. Für jede importierte Kurve wird parallel der originale DXF-Layer gespeichert; zusätzlich liefert `PlanarGeometry` die tatsächlich verwendeten Layernamen.

Neue Felder:

- `planarGeometry.curveLayers[]` — 1:1-Zuordnung zu `curves[]`
- `planarGeometry.layerNames[]` — eindeutige verwendete Layer

Das TypeScript-Datenmodell enthält bereits den buildneutralen `CarveOperation`-Vertrag mit:

- mehreren `curveIds`,
- optionalem `layerName`,
- eigenem Werkzeug,
- Gesamttiefe und Zustellung,
- Vorschub / Eintauchvorschub / Drehzahl / Sicherheits-Z.

Als konservativer Referenzwert ist Ø 0,6 mm vorbereitet. `CarveOperation` wird absichtlich erst dann Teil der aktiven `CamOperation`-Union, wenn Gate 6B die sichtbare Auswahl und den Preflight gemeinsam verdrahtet. Dadurch bleiben die geschlossenen Kontur- und Taschen-Pfade während Gate 6A buildneutral und regressionsgeschützt.

### Geplante Folgegates

**Gate 6B — Auswahl und UX**

- `Kontur | Tasche | Carve` unter `04 · Bearbeiten`, ohne neuen linken Workflow-Schritt.
- Mehrfachauswahl offener DXF-Geometrien.
- Komfortauswahl über Layer, insbesondere `FRET_SLOTS`.
- Sichtbare Centerline-Werkzeugbahn ohne Radiusoffset.

**Gate 6C — Preflight und G-Code**

- nur unterstützte offene Geometrien freigeben,
- exakte Centerline-Koordinaten prüfen,
- Z-Zustellungen und Schnittdaten prüfen,
- mehrere Segmente sicher anfahren,
- `.nc`-Export.

**Gate 6D — Reihenfolge und CAMotics**

- sichere, kurze Verfahrreihenfolge zwischen mehreren Segmenten,
- keine Änderung der einzelnen CAD-Linien,
- CAMotics-Regression am CBG-Griffbrett.

Erst danach wird Gate 6 geschlossen.
