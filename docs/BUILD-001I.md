# BeBlog CAM — Build 001I

## Ziel

001I beginnt den nächsten Architektur-Meilenstein nach dem in 001H bewiesenen klassischen 2D-CAM-Grundstock `Kontur · Tasche · Carve`.

Der Schwerpunkt liegt nun auf **mehreren Bearbeitungen innerhalb eines Projekts**. Die bewiesenen Geometrie-, Preflight- und G-Code-Kerne aus 001H werden in Gate 7A ausdrücklich noch nicht verändert.

Referenzbauteil bleibt das reale CBG-Griffbrett:

1. `FRET_SLOTS` → Carve → Ø 0,6 mm,
2. `OUTLINE` → Kontur außen → separates Werkzeug.

## Gate 7A — Operationsmodell und Bearbeitungsliste

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

### UX-Grundsatz

Die lineare Hauptnavigation bleibt unverändert:

`01 Bauteil → 02 Rohling → 03 Werkzeuge → 04 Bearbeiten → 05 Prüfen → 06 Fräsen`

Mehrere Operationen erzeugen keinen neuen Hauptschritt und keine zusätzliche CMS-artige Navigation. Sie werden als ruhige Bearbeitungsliste innerhalb `04 · Bearbeiten` geführt.

### Architektur

Der bisherige Einzelzustand wurde kontrolliert zu einem Projektzustand erweitert:

- `operations: CamOperation[]`
- `activeOperationId: string | null`
- eine daraus abgeleitete aktive Operation für die bestehenden Editoren, Preflights und G-Code-Panels.

Der pure Operationskern liegt in `src/lib/operationsProject.ts`.

Jede Operation behält eine unabhängige Kopie ihrer:

- konkreten Geometrieauswahl,
- Werkzeugdaten,
- Schnittdaten,
- bearbeitungsspezifischen Parameter.

Insbesondere werden Carve-`curveIds[]` und Werkzeugobjekte beim Anlegen/Wechseln geklont, damit Bearbeitungen keine Zustände miteinander teilen.

### Sichtbare Bearbeitungsliste

Unter `04 · Bearbeiten` ist nun eine kompakte Operationsliste aktiv. Sie zeigt pro Bearbeitung:

- laufende Nummer,
- Operationstyp,
- kurze Geometrie-/Strategiezusammenfassung,
- Werkzeugdurchmesser.

Die aktive Bearbeitung wird ruhig hervorgehoben. Neue Bearbeitungen können als `Kontur`, `Tasche` oder `Carve` hinzugefügt werden. Bei mehr als einer Operation kann eine Bearbeitung einzeln gelöscht werden.

Die bestehenden Parameterfelder bearbeiten ausschließlich die aktive Operation. Beim Wechsel wird der gespeicherte Zustand der anderen Operation nicht überschrieben.

### Gate-7A-Sicherheitsgrenze

Gate 7A verändert **nicht**:

- Werkzeugradiuskorrektur,
- Taschengeometrie,
- Carve-Centerlines,
- Preflight-Mathematik,
- G-Code-Erzeuger,
- `.nc`-Export,
- Reihenfolge oder Semantik bestehender Maschinenbewegungen.

`05 · Prüfen` und `06 · Fräsen` arbeiten weiterhin ausschließlich mit der jeweils aktiven Operation. Ein Gesamtjob und Werkzeugwechsel folgen erst in einem eigenen Gate.

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
