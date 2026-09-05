# Build 004E — STEP Helixfräsen

## Ziel

004E verbindet die in 004C erkannten STEP Hole Features mit der bereits vorhandenen Helixstrategie. STEP bleibt BRep Source of Truth; es wird keine DXF-Geometrie erzeugt.

## Vertrag

`STEP Hole Feature -> gemeinsame Helixprimitive -> Canonical arc3 motions -> Preflight -> Job G-Code`

## Umsetzung

- Die Helixmathematik liegt zentral in `buildCanonicalHelicalDescent`.
- Der bestehende DXF-G-Code-Helfer `buildHelicalDescent` nutzt dieselbe kanonische Primitive.
- STEP verwendet für Helixfräsen den Fräsermittelbahnradius `(Bohrungs-Ø - Werkzeug-Ø) / 2`.
- Das Werkzeug muss strikt kleiner als die erkannte Bohrung sein.
- Die Z-Zustellung pro Umdrehung kommt aus `stepDownMm`.
- Nach Erreichen der Endtiefe folgt ein vollständiger Fertigumlauf.
- Vorschau, Preflight und Gesamtjob verwenden denselben Canonical Toolpath.

## Bewusste Grenzen

- nur Bohrungsachsen parallel zur Maschinen-Z-Achse
- keine X/Y-Kippung des Bauteils
- WCS Z weiterhin auf Rohlingoberseite
- keine Hole Recognition Erweiterung in diesem Build
- keine native OCCT/C++ Änderung

## Lokale Gates

```bash
pnpm check:004a
pnpm check:004b
pnpm check:004c
pnpm check:004d
pnpm check:004e
pnpm check
pnpm build
```

`pnpm native:test` ist für 004E nicht erforderlich, da die native STEP/BRep-Grenze unverändert bleibt.
