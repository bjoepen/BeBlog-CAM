# Build 011-C – Spanungsdickenkorrektur (advisory only)

## Ziel und Grenze
Pure Funktion in `src/lib/chipThicknessAdvisory.ts`. Kein Eingriff in NC, Preflight,
Werkzeugwege, UI oder `feedsSpeeds.ts`. Die Ergebnisse sind nicht als physikalische
Lastprognosen, Maschinenfreigaben oder numerisch validierte Hersteller-Schnittwerte zu verstehen.

Die Näherung gilt für das **periphere Fräsen bei bekannter radialer Eingriffsbreite ae**,
nicht für Helix, Rampe, unbekanntes Restmaterial oder wechselnde Eingriffsverhältnisse.

- Zahnvorschub `fz = vf / (n * z)`
- `q = ae / D`
- Maximale ideale Spanungsdicke: `hmax = fz * factor`
- `factor = 2 * sqrt(q * (1-q))` bei `q < 0.5`, sonst `factor = 1`.
- Nur mit **explizit** bereitgestelltem Zielwert `hmaxTarget` wird eine
  Vorschubempfehlung abgeleitet und bei Bedarf durch `maxFeedMmMin` begrenzt.
  Es findet keine heimliche Feed-Übernahme statt.

`assessAdvisoryRange` unterscheidet `pass`, `warn`, `unavailable`;
diese Kennzeichen sind **keine** Manufacturing-FAIL-/PASS-Gates.
Es wird niemals eine Warnung als Freigabe einer realen Bearbeitung ausgegeben.

## Tests
`node scripts/check-011c-chip-thickness.mjs`
`pnpm check`
`pnpm build`

Acceptance: ae/D = 0.1, Halb- und Vollumschlingung, Maschinenlimit,
fehlender Zielwert, nicht-endliche Eingaben, Grenzwerte und Immutabilität.
Zusätzlich steht der unabhängige Vergleich mit Millalyzer Static als
**separater manueller Plausibilitätsversuch** an. Keine behauptete Validierung
durch die Ergebnisse des externen Modells.

## Nächster Build
011-D: UI/Operationsübernahme nach Audit; manuelle Eingaben behalten Vorrang.
Die bestehende 140-Grad-Materialgrenze bleibt unverändert.
