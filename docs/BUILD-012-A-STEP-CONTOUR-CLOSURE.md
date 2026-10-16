# Build 012-A – STEP-Seitenflächen-Konturschluss

## Beobachtung
Drei zusammenhängende STEP-Seitenflächen erzeugen eine offene Kontur.
Die vierte Seite schließt den Ring; bisher verwirft `chainSegments`
diese Geometrie. Alle Werkzeugwege verschwinden. Auch ein Umschalten
im Inspektor auf »Geschlossen« reicht bislang nicht aus:
`stepWireId` bleibt leer und die Pipeline verlangt zwingend diesen Wert.

## Implementierung
- Unabhängige Seitenflächen-Ketten erkennen nun `open` oder `closed`,
  anstatt geschlossene Ringe zu verwerfen.
- `buildStepContourOperationState` lässt bei ausdrücklich gewähltem
  geschlossenem Konturtyp die komplette Seitenflächen-Ringauswahl zu.
  Der vorhandene geschlossene Offset-/Validierungspfad bleibt unverändert.
- Die Auswahl von Seitenflächen im STEP-Viewport überschreibt den
  expliziten Konturtyp nicht mehr mit `open`.
- Eine geschlossene Seitenflächenkette unter Konturtyp »Offen« wird
  abgewiesen. Unverbundene Geometrie bleibt gesperrt.

## Einschränkung
Das bloße Umschalten auf »Geschlossen« ohne Auswahl eines gültigen
geschlossenen Rings bzw. einer eindeutigen Wire erzeugt weiterhin
bewusst keine Bahn. Kein automatisches Erraten einer Wire.

## Lokale Abnahme
1. `node scripts/check-012a-step-contour-closure.mjs`
2. `pnpm check`
3. `pnpm build`
4. `pnpm native:dev`
5. Dasselbe STEP-Teil laden: drei Seiten im Modus »Offen« -> Bahnen;
   alle vier Seiten im Modus »Geschlossen« -> geschlossener Ring.
6. Negativ: vier Seiten im Modus »Offen« -> keine falsche offene Bahn;
   unzusammenhängende Auswahl -> keine Bahn; Offset innen/außen
   samt Preflight und NC prüfen.
7. Keine Merge-Freigabe ohne PASS, Greptile und Review.

Keine Änderungen an `main` oder NC-Sicherheitsfreigaben.
