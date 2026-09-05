# Build 004D — STEP Drilling

004D verbindet die in 004C erkannten STEP Hole Features mit dem bestehenden Canonical-Toolpath-/Postprozessorkern.

## Enthalten

- `DrillOperation.stepHoleFeatureIds` als operation-owned STEP-Auswahl
- direkte STEP/BRep → Hole Feature → Canonical Drill Motion Kette
- exakte Tiefe aus dem erkannten zylindrischen Hole Feature
- Maschinenraum-Transformation aus Setup, Placement, Z-Rotation und WCS
- konservative Freigabe nur für Z-parallele Bohrungsachsen
- STEP-Bohrung in Active Canonical Toolpath, Job Preflight und Gesamtjob-G-Code
- DXF-Bohren bleibt unverändert

## Sicherheitsgrenzen

004D gibt ausschließlich `method: drill` für STEP frei. Helixfräsen bleibt absichtlich für 004E gesperrt. X/Y-gekippte Bauteile, fehlender Rohling, WCS Unterseite und nicht-z-parallele Hole Features failen geschlossen.

Es wird keine Pseudo-DXF-Geometrie erzeugt. STEP bleibt BRep Source of Truth.

## Lokale Gates

```bash
pnpm check:004a
pnpm check:004b
pnpm check:004c
pnpm check:004d
pnpm check
pnpm build
```

Kein neuer OCCT-C++-Code wurde eingeführt; `pnpm native:test` ist für 004D daher kein Entwicklungs-Pflichtgate.

## Noch offen

Die interaktive STEP-Bohrungsauswahl im Bearbeiten-UI wird als nachgelagerte UX-Anbindung auf `stepHoleFeatureIds` gesetzt. 004D selbst etabliert die vollständige operation-owned CAM-/Preflight-/Export-Kette.
