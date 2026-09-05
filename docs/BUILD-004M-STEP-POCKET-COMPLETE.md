# Build 004M — STEP Pocket vollständig machen

## Ziel

004M schließt die absichtlich konservativen Lücken aus 004G für STEP-Taschen. Die explizit ausgewählte planare BRep-Face bleibt die einzige Fertigungsquelle.

## Enthalten

- Rasterstrategie auf STEP-Regionen bleibt erhalten.
- Automatik wählt für insellose Regionen konzentrisch und für Regionen mit Inseln konturparallel.
- Konturparallele Bahnen entstehen aus wiederholten Offset-Lagen von Außenrand und Inseln.
- Konzentrisch ist in 004M bewusst nur für insellose Regionen freigegeben.
- Rampeneinstieg wird als kanonische `line3`-Bewegung erzeugt und gegen Rampenwinkel sowie verfügbare Bahnlänge geprüft.
- Helixeinstieg wird als kanonische `arc3`-Bewegung erzeugt und nur freigegeben, wenn ein kollisionsfreier Helixkreis in der werkzeugradiusbereinigten Region nachgewiesen wird.
- Plunge bleibt als robuste Alternative verfügbar.
- STEP-G-Code nutzt weiterhin den bestehenden Canonical Pocket Poster.

## Sicherheitsregeln

- Keine STEP-Tasche ohne explizite `stepFaceId`.
- Keine X/Y-Kippung im 004M-Scope.
- Z-Null oben bleibt erforderlich.
- Konzentrisch + Inseln => FAIL mit Empfehlung Raster/Konturparallel.
- Zu kurze Rampenbahn => FAIL statt steilerer impliziter Rampe.
- Kein sicherer Helixkreis => FAIL statt Plunge-Fallback.

## Gate

```bash
pnpm check:004m
pnpm check
pnpm build
```

`pnpm native:test` ist nicht erforderlich; 004M verändert weder OCCT noch den nativen STEP-Bridge-Vertrag.
