# Build 004C — STEP Hole Recognition

## Ziel

004C erkennt aus der in 004A/004B aufgebauten exakten STEP/BRep-Semantik konservative Bohrungs-Kandidaten. Es wird noch kein Bohr- oder Helix-Werkzeugweg erzeugt.

## Eingang

`StepManufacturingFeatureSource` liefert:

- zylindrische BRep-Faces
- exakte Kreis-Kanten
- Face → Wire → Edge-Topologie
- stabile IDs

004C benötigt keine zusätzliche C++-/OCCT-Bridge-Erweiterung.

## Anerkennungsregel

Ein zylindrisches Face wird nur dann als `StepHoleFeature` akzeptiert, wenn:

1. exakt zwei geschlossene Kreis-Kanten zu seinem Face gehören,
2. deren Radius dem Zylinderradius innerhalb enger Toleranz entspricht,
3. deren Achsen parallel zur Zylinderachse sind,
4. zwischen den beiden Kreismittelpunkten eine positive Tiefe liegt.

Ausgegeben werden u. a.:

- Feature-ID
- Face-ID
- Boundary-Edge-IDs
- Achse
- Start-/Endmittelpunkt
- Durchmesser
- Tiefe

## Fail closed

004C errät bewusst nicht, ob eine Bohrung blind oder durchgehend ist. `termination` bleibt `unknown`, bis eine spätere Topologie-/Stock-Regel diese Aussage belastbar machen kann.

Ebenso werden keine halben Zylinder, Fasen, Taschenrundungen oder sonstigen zylindrischen Flächen automatisch als Bohrung akzeptiert, wenn die beiden exakten Kreisgrenzen fehlen.

## Scope-Grenze

Nicht Teil von 004C:

- Drill Toolpath
- Helix Toolpath
- Werkzeugwahl
- Zustellung / Peck
- Blind-/Durchgangsklassifikation
- UI-Auswahl

## Lokale Gates

Vor Push / Merge bevorzugt lokal ausführen:

```bash
pnpm check
pnpm build
pnpm check:004a
pnpm check:004b
pnpm check:004c
```

Da 004C keine native Bridge ändert, ist `pnpm native:test` für die Entwicklungsiteration nicht erforderlich. GitHub OCCT Native bleibt ein unabhängiges Integrations-Gate.

## Danach

004D verbindet `StepHoleFeature` mit der bestehenden DrillOperation. 004E nutzt dieselben Features für Helixfräsen.
