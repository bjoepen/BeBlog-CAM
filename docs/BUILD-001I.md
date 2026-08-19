# BeBlog CAM — Build 001I

## Ziel

001I beginnt den nächsten Architektur-Meilenstein nach dem in 001H bewiesenen klassischen 2D-CAM-Grundstock `Kontur · Tasche · Carve`.

Der Schwerpunkt liegt nun auf **mehreren Bearbeitungen innerhalb eines Projekts**. Die bewiesenen Geometrie-, Preflight- und G-Code-Kerne aus 001H werden in Gate 7A ausdrücklich noch nicht verändert.

Referenzbauteil bleibt das reale CBG-Griffbrett:

1. `FRET_SLOTS` → Carve → Ø 0,6 mm,
2. `OUTLINE` → Kontur außen → separates Werkzeug.

## Gate 7A — Operationsmodell und Bearbeitungsliste

Status: **GESTARTET**

### UX-Grundsatz

Die lineare Hauptnavigation bleibt unverändert:

`01 Bauteil → 02 Rohling → 03 Werkzeuge → 04 Bearbeiten → 05 Prüfen → 06 Fräsen`

Mehrere Operationen erzeugen keinen neuen Hauptschritt und keine zusätzliche CMS-artige Navigation. Sie werden als ruhige Bearbeitungsliste innerhalb `04 · Bearbeiten` geführt.

Zielbild:

```text
Bearbeitungen

01  Carve
    FRET_SLOTS · 16 Linien · Ø 0,6 mm

02  Kontur
    OUTLINE · Außen · Ø 3,0 mm

+ Bearbeitung
```

### Architektur

Der bisherige Einzelzustand

`operation: CamOperation`

wird kontrolliert zu einem Projektzustand erweitert:

- `operations: CamOperation[]`
- `activeOperationId: string | null`
- abgeleitet: aktive Operation

Jede Operation behält ihre eigene konkrete Geometrieauswahl, Werkzeugzuordnung und Schnittdaten.

### Gate-7A-Sicherheitsgrenze

Gate 7A verändert **nicht**:

- Werkzeugradiuskorrektur,
- Taschengeometrie,
- Carve-Centerlines,
- Preflight-Mathematik,
- G-Code-Erzeuger,
- `.nc`-Export,
- Reihenfolge oder Semantik bestehender Maschinenbewegungen.

`05 · Prüfen` und `06 · Fräsen` arbeiten zunächst weiterhin nur mit der jeweils aktiven Operation. Ein Gesamtjob und Werkzeugwechsel folgen erst in einem eigenen Gate.

### Erforderlicher Realtest

Gate 7A ist PASS, wenn am CBG-Griffbrett:

1. eine Carve-Operation für `FRET_SLOTS` angelegt werden kann,
2. der Nullbund entfernt werden kann und die Auswahl beim Wechsel der aktiven Operation erhalten bleibt,
3. eine zweite Konturoperation für `OUTLINE` angelegt werden kann,
4. zwischen beiden Operationen verlustfrei gewechselt werden kann,
5. Werkzeug- und Schnittdaten pro Operation unabhängig erhalten bleiben,
6. eine Operation gelöscht werden kann, ohne die andere zu verändern,
7. die aktive Operation weiterhin durch die bestehenden Einzel-Preflight- und G-Code-Pfade verarbeitet wird,
8. Kontur/Tasche/Carve keine Regression gegenüber 001H zeigen.

Erst danach wird Gate 7A geschlossen.

## Folge-Gates

Nach Gate 7A folgen getrennt:

- projektweiter Preflight über mehrere Operationen,
- Werkzeuggruppierung und Werkzeugwechsel,
- Gesamtjob-G-Code,
- sichere Job-End-/Parkstrategie.
