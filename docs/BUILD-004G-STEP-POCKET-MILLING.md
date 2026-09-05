# Build 004G — STEP Pocket Milling

## Ziel

004G verbindet planare STEP/BRep-Face-Regionen mit der kanonischen Taschenbearbeitung.

`STEP BRep -> planare Face + geschlossene Wires -> äußere Region + Inseln -> Werkzeugmittelpunkt-Region -> Canonical Pocket Toolpath -> Preflight -> Gesamtjob`

## Enthalten

- `PocketOperation.stepFaceId` als optionales STEP-Ziel
- horizontale planare Face-Kandidaten aus der exakten 004A/004B-Semantik
- äußerer Wire plus innere Wires als Inseln
- Werkzeugradius-Freistellung: Außenrand nach innen, Inseln nach außen
- STEP-Face-Z bestimmt die reale Zieltiefe relativ zu Rohling/WCS
- mehrstufige Zustellung über `stepDownMm`
- kanonische Rasterstrategie mit `stepoverPercent`
- STEP-aware Active Toolpath, Job Preflight und Gesamtjob-Export

## Fail-closed

- kein Rohling / WCS unten
- X/Y-gekippte Aufspannung
- nicht horizontale oder nicht geschlossene Face-Regionen
- Werkzeug zu groß für die freigestellte Region
- nicht erzeugbare Rasterbahn

## Bewusst noch nicht Teil von 004G

- explizite interaktive STEP-Face-Auswahl im UI
- Ramp-/Helix-Einstieg für STEP-Taschen
- konzentrische / konturparallele STEP-Pocket-Strategie
- Restmaterial-/Restmachining
- Overcut / Rohlingunterseite und Tabs (folgende Pflichtblöcke)

## Architektur

Es gibt keine STEP→DXF-Konvertierung. STEP bleibt BRep Source of Truth. Die erzeugte Rasterbahn ist direkt ein `CanonicalToolpath`.

## Lokale Gates

```bash
pnpm check:004a
pnpm check:004b
pnpm check:004c
pnpm check:004d
pnpm check:004e
pnpm check:004f
pnpm check:004g
pnpm check
pnpm build
```

`pnpm native:test` ist nicht erforderlich, da 004G den nativen OCCT-Bridge-Code nicht verändert.
