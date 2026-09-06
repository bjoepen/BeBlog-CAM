# Build 004R — Fixture & Clamp Collision v1

## Ziel

004R erweitert den Produktions-Preflight um definierte Spannmittel und Sperrvolumen. Die erste Stufe bleibt bewusst 2.5D und verwendet einfache quaderförmige Fixture-Volumen im WCS.

## Fixture-Vertrag

Ein Spannmittel besitzt:

- stabile ID und Namen,
- aktiv/inaktiv,
- XY-Footprint (`minX/maxX`, `minY/maxY`),
- Z-Unterkante und Z-Oberkante relativ zum aktuellen WCS.

Damit lassen sich Schraubstockbacken, Spannpratzen, Anschläge und andere rechteckig angenäherte Sperrbereiche konservativ modellieren.

## Kollisionsklassen

004R prüft drei getrennte Werkzeughüllen:

1. **Fräser** — Werkzeugradius innerhalb der Schneidenlänge,
2. **Schaft** — Schaftradius oberhalb der Schneiden,
3. **Halter** — Halterradius ab Halternase/Auskragung.

Eine Kollision wird als explizites FAIL ausgegeben und nennt Spannmittel sowie kollidierende Hülle.

## Abgrenzung v1

Noch nicht enthalten:

- beliebige Mesh-/STEP-Spannmittel,
- gedrehte Fixture-Volumen,
- Spannzange und Spindelnase als eigene Konturen,
- Maschinenraum-/Achsenkollision,
- vollwertiger 3D Swept-Solid-Test.

Diese Punkte bauen später auf dem 004R-Vertrag auf.

## Local-first Gate

```bash
pnpm check:004r
pnpm check
pnpm build
```

Keine nativen OCCT-Änderungen; `pnpm native:test` ist für 004R v1 nicht erforderlich.
