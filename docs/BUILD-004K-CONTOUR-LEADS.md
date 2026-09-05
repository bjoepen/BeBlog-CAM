# Build 004K — Kontur Lead-in / Lead-out

## Ziel
Geschlossene DXF- und STEP-Konturen erhalten denselben kontrollierten tangentialen Ein- und Ausfahrweg auf dem kanonischen Werkzeugweg.

## Vertrag
- `leadMode`: `none` oder `line`
- `leadInLengthMm`: tangentiale Einfahrlaenge
- `leadOutLengthMm`: tangentiale Ausfahrlaenge
- 004K ist zunaechst nur fuer geschlossene Konturen freigegeben.
- Tabs werden zuerst auf den Konturpass angewendet; Leads werden danach auf die zusammenhaengende Passage gesetzt.
- Entry und Exit sind echte kanonische Maschinenbewegungen und werden vom Kontur-Poster ausgegeben.
- DXF und STEP verwenden denselben `applyContourLeads()` Transformer.

## Sicherheitsgrenzen
- Lead-in muss > 0 mm sein.
- Lead-out darf 0 mm sein, aber nicht negativ.
- Offene Konturen werden bei aktivierten Leads abgewiesen.
- Ein Lead unter einem halben Werkzeugdurchmesser erzeugt eine Warnung.

## Nicht Bestandteil von 004K
- Radius-/Bogen-Leads
- frei im Viewport verschiebbarer Startpunkt
- Rampen in Z

Diese Punkte koennen auf demselben Canonical-Entry/Exit-Vertrag aufbauen.

## Gates
`pnpm check:004k`
`pnpm check`
`pnpm build`
