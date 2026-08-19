# BeBlog CAM — Build 001H

## Ziel

001H erweitert den bewiesenen 2D-CAM-Kern schrittweise, ohne bestehende PASS-Pfade zu verändern.

## Gates 1–5

**PASS / GESCHLOSSEN.** Rechtecktasche, Preflight, `.nc`, CAMotics, optimierter Wandumlauf sowie senkrechte und analytisch geprüfte lineare Rampenzustellung sind verifiziert.

Freigegebener Taschenpfad:

`DXF-Sollkontur → radiuskorrigierte Taschenfläche → Rasterstrategie → Preflight → Senkrecht ODER geprüfte Rampe → Z-Zustellungen → Wandumlauf → .nc → CAMotics`

## Gate 6 — Carve / Mittellinienbearbeitung

Referenzbauteil ist das reale CBG-Griffbrett `CBG_Diatonic_3_String_635mm.dxf`. Die Bundschlitze liegen als einzelne offene Linien auf dem DXF-Layer `FRET_SLOTS` und werden mit einem Ø 0,6-mm-Fräser bearbeitet. Die Außenkontur bleibt eine separate Konturoperation.

### Verbindliche Semantik

- **Kontur:** CAD-Geometrie beschreibt die fertige Werkstückkante; Fräsermittelbahn wird radiuskorrigiert.
- **Tasche:** CAD-Geometrie beschreibt die fertige Flächenbegrenzung; der Innenraum wird radiuskorrigiert geräumt.
- **Carve:** CAD-Geometrie **ist die Fräsermittellinie**. Es gibt keinen seitlichen Werkzeugradius-Offset.

## Gate 6A — DXF-Layer als CAM-Semantik

Status: **PASS / GESCHLOSSEN**

Der DXF-Importer bewahrt Layerinformationen je Kurve und als eindeutige Layerliste. Anwendungstart und DXF-Darstellung wurden nach dem Umbau regressionsgeprüft.

**Gate 6A = PASS.**

## Gate 6B — Carve-Auswahl und UX

Status: **PASS / GESCHLOSSEN**

Carve unterstützt `Einzeln` und `Ebene`. Die Ebenenwahl ist nur eine komfortable Vorauswahl; maßgeblich bleibt immer `curveIds[]`.

Verbindliche Regel:

**Ebene = Vorauswahl. Konkrete Geometrieauswahl = verbindliche Bearbeitungsmenge.**

Der Realtest am CBG-Griffbrett bestätigte insbesondere das gezielte Entfernen des Nullbundes aus `FRET_SLOTS` und die unveränderte Centerline-Darstellung ohne Offset.

**Gate 6B = PASS.**

## Gate 6C — mathematischer Carve-Preflight

Status: **PASS / GESCHLOSSEN**

Der Realtest am CBG-Griffbrett wurde mit 16 konkret ausgewählten offenen DXF-Linien bestanden. `05 · Prüfen` bestätigte:

- 16 gespeicherte Geometrie-IDs,
- Ebene `FRET_SLOTS` nur als Vorauswahl/Herkunft,
- 16 offene DXF-`LINE`-Entities,
- Gesamt-Centerline-Länge `711.742 mm`,
- Werkzeug Ø `0.600 mm`,
- seitlicher Offset explizit `0.000 mm`,
- Soll = Ist = ausgewählte DXF-Centerline,
- gültige Tiefen/Zustellungen und Schnittdaten,
- Sicherheits-Z.

Der sichtbare Gesamtstatus war wegen `Kein Rohling` erwartungsgemäß WARN; die Carve-Geometrie selbst bestand alle relevanten Prüfungen.

Gate 6C bleibt bewusst auf exakte offene DXF-`LINE`-Entities begrenzt. ARC und offene LWPOLYLINE benötigen eigene Interpolations-Gates.

**Gate 6C = PASS.**

## Gate 6D — Carve-G-Code, sichere Mehrsegment-Anfahrt und `.nc`

Status: **IMPLEMENTIERT / CAMOTICS-REALTEST AUSSTEHEND**

Der in Gate 6C freigegebene Centerline-Pfad wird nun als Maschinen-Code ausgegeben.

Implementierung:

- `src/lib/carveGcode.ts` — G-Code-Kern,
- `src/lib/CarveGCodePanel.svelte` — Vorschau, PASS/FAIL und `.nc`-Export,
- `06 · Fräsen` ist für Carve freigeschaltet.

### Sicherheitsregeln

- keine seitliche Radiuskorrektur,
- jede ausgewählte DXF-Linie bleibt geometrisch unverändert,
- Segmentwechsel erfolgen ausschließlich auf Sicherheits-Z,
- pro Segment: Sicherheits-Z → XY-Anfahrt → Eintauchen → exakte Centerline-Fahrt → Sicherheits-Z,
- mehrere Z-Zustellungen erreichen exakt die Solltiefe,
- WCS-Unterseite bleibt in diesem Gate gesperrt,
- ARC/offene Polyline bleiben gesperrt, weil Gate 6C sie nicht freigibt.

### Verfahrreihenfolge

Zwischen getrennten Segmenten wird eine einfache Nächster-Nachbar-Reihenfolge verwendet. Diese Optimierung verändert keine CAD-Geometrie. Eine Linie darf lediglich in umgekehrter Richtung durchlaufen werden, wenn dadurch der sichere Leerweg zum nächsten Startpunkt kürzer wird.

Verbindliche Regel:

**Optimiert werden nur sichere Leerwege; die ausgewählte CAD-Centerline selbst wird niemals verändert.**

### Export

Der `.nc`-Export speichert exakt den aktuell angezeigten Carve-G-Code. Standardname: `*-carve.nc`.

### Gate-6D-Realtest

Für PASS:

1. CBG-DXF laden.
2. `FRET_SLOTS` wählen und Nullbund entfernen → 16 Linien.
3. Gate-6C-Preflight muss weiterhin freigabefähig sein.
4. `06 · Fräsen` öffnen und `.nc` exportieren.
5. Datei in CAMotics simulieren.
6. Jede der 16 Linien muss auf jeder Z-Ebene exakt auf der DXF-Centerline abgefahren werden.
7. Zwischen getrennten Linien muss der Fräser vor der XY-Verfahrt auf Sicherheits-Z stehen.
8. Keine zusätzliche oder wieder hineingeratene Nullbund-Linie darf erscheinen.

Erst nach diesem externen Simulationstest wird Gate 6D geschlossen.
