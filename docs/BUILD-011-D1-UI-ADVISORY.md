# Build 011-D1 – Kontextgebundene Empfehlungen in der Rechner-UI

## Ausgangspunkt
Audit auf `main` nach PR #142: 011-B1 und 011-C vorhanden. Die bestehende
`FeedsSpeedsCalculator.svelte`-Hülle übergab trotz ausgewählter Operation
`targetOperation={null}`; dadurch war die Core-Werkzeugkompatibilität nicht aktiv.

## Scope
- Reale ausgewählte `CamOperation` wird über App -> Wrapper -> Core übergeben.
- Advisory-`ae`/`ap`-Bereiche im vorhandenen Rechner sichtbar, inklusive
  expliziter Maschinensteifigkeits-Einschätzung.
- Bestehende `stepDownMm` wird nur **als beratender Vergleich** mit ap gezeigt,
  für Pocket-Helix aber **nicht**, weil sie dort Pitch/Umdrehung bedeutet.
- Ein Spurabstand-Vergleich ist nur ein Vergleich mit einem numerischen Wert,
  **keine Zusicherung tatsächlicher radialer Materialumschlingung**.
- Spanungsdickenanzeige nutzt den heuristischen ae-Startwert nur als
  illustriertes Rechenbeispiel, **nicht** den tatsächlichen Werkzeugkontakt.
- Keine automatische Übernahme von ae/ap, keine verdeckte Änderung bestehender
  Parameter oder manuell eingestellter Werte.

## Sicherheitsgrenzen
Die neue Anzeige ist keine Herstellerdatenbank, CNC-Maschinenfreigabe, NC-Gate
oder Kraftsimulation. Alle bestehenden Preflight-, Toolpath- und 140°-Regeln
bleiben unverändert. Echte belastbare ae-Übernahme erfordert später
operationsabhängige Semantik und Benutzerbestätigung (011-D2).

## Lokaler Workflow
1. `git switch build-011-d1-engagement-ui` und `git pull`
2. `node scripts/check-011b-cutting-engagement.mjs`
3. `node scripts/check-011c-chip-thickness.mjs`
4. `pnpm check`
5. `pnpm build`
6. Native App starten; mit Projekt und Operation den Tab Werkzeuge ->
   Drehzahl & Vorschub prüfen. Pocket-Helix besonders auf korrekte Warnungen prüfen.
7. Keine Merge-Freigabe vor PASS/Audit.
