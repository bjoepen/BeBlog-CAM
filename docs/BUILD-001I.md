# BeBlog CAM — Build 001I

## Ziel

001I erweitert den in 001H bewiesenen klassischen 2D-CAM-Grundstock `Kontur · Tasche · Carve` um mehrere Bearbeitungen innerhalb eines Projekts.

Referenzbauteil bleibt das reale CBG-Griffbrett:

1. `FRET_SLOTS` → Carve → Ø 0,6 mm,
2. `OUTLINE` → Kontur außen → Ø 3,0 mm.

## Gate 7A — Operationsmodell und Bearbeitungsliste

Status: **PASS / GESCHLOSSEN**

Der Realtest bestätigte die gewünschte 7A-Semantik: Mehrere Bearbeitungen können angelegt und unabhängig gespeichert werden. Je nachdem, welche Operation aktiv markiert ist, arbeiten die bestehenden Einzel-Preflight- und Einzel-G-Code-Pfade mit genau dieser Operation. Damit ist nachgewiesen, dass die Bearbeitungen nicht gegenseitig ihre Geometrie- oder Werkzeugdaten überschreiben.

Die lineare Hauptnavigation bleibt unverändert:

`01 Bauteil → 02 Rohling → 03 Werkzeuge → 04 Bearbeiten → 05 Prüfen → 06 Fräsen`

Mehrere Operationen werden als ruhige Liste innerhalb `04 · Bearbeiten` geführt.

Verbindliche Architektur:

- `operations: CamOperation[]`
- `activeOperationId: string | null`
- unabhängige Geometrieauswahl, Werkzeug- und Schnittdaten pro Operation.

**Gate 7A = PASS.**

## Gate 7B — Gesamtjob und kontrollierter Werkzeugwechsel

Status: **PASS / GESCHLOSSEN**

Gate 7B verbindet mehrere bereits bewiesene Einzeloperationen zu einer gemeinsamen `.nc`-Datei.

Wichtige Sicherheitsentscheidung: Die Geometrie- und G-Code-Kerne für Kontur, Tasche und Carve werden nicht neu implementiert. `src/lib/jobGcode.ts` ruft die bestehenden Generatoren auf und verbindet deren freigegebene Maschinenbewegungen lediglich auf Programmebene.

### Gesamtjob-Regeln

- alle aktivierten Operationen werden in Listenreihenfolge ausgegeben,
- jede Operation muss für sich freigabefähig sein; ein Einzel-FAIL blockiert den Gesamtjob,
- `G21 / G90 / G17` werden einmal global gesetzt,
- die einzelnen Maschinenbewegungen der bewiesenen Generatoren bleiben unverändert,
- `M30` erscheint nur einmal am Ende des Gesamtjobs,
- unterschiedliche Werkzeuge erzeugen einen manuellen, sicheren Werkzeugwechsel,
- gleicher Werkzeugtyp benötigt keinen Werkzeugwechselhalt.

### Manueller Werkzeugwechsel

Bei einem Wechsel auf ein anderes Werkzeug wird konservativ erzeugt:

```text
G0 Z<max. Sicherheits-Z>
M5
( Werkzeugwechsel )
M0 ( Werkzeug ... einsetzen und bestaetigen )
```

Erst nach Bestätigung startet die nächste Operation mit ihren eigenen Drehzahl- und Schnittdaten.

Ein automatischer `M6`-Wechsel wird in Gate 7B bewusst nicht vorausgesetzt; Referenz ist weiterhin eine Hobby-CNC ohne ATC.

### UX

Sobald das Projekt mehr als eine Operation enthält, zeigt `06 · Fräsen` einen **Gesamtjob** statt nur den gerade markierten Einzelpfad. Der Exportname ist wieder die Bauteildatei mit `.nc`, da die Datei nun den vollständigen Job repräsentiert.

Die Einzelgeneratoren bleiben weiterhin verfügbar, wenn nur eine Operation im Projekt existiert.

### Gate-7B-Realtest

Der Referenz-Gesamtjob des CBG-Griffbretts wurde extern mit **NC Viewer und CAMotics** geprüft. Beide unabhängigen Simulatoren bestätigen die zwei gewünschten Operationen innerhalb desselben Maschinenprogramms:

1. Carve der ausgewählten `FRET_SLOTS` mit Ø 0,6 mm,
2. Außenkontur `OUTLINE` mit Ø 3,0 mm.

Damit ist insbesondere nachgewiesen, dass der Export nicht mehr von der aktuell markierten Einzeloperation abhängt, sondern das Operationsprojekt als Gesamtjob verarbeitet. Die beiden zuvor einzeln bewiesenen Bearbeitungspfade erscheinen gemeinsam in der Simulation.

Der Werkzeugwechsel zwischen den unterschiedlichen Werkzeugen bleibt als kontrollierter manueller Halt Bestandteil des Gesamtjobs.

**Gate 7B = PASS.**

## Meilenstein

BeBlog CAM besitzt nun erstmals einen vollständigen Multi-Operation-Workflow:

`DXF → mehrere Bearbeitungen → unabhängige Werkzeug-/Schnittdaten → Gesamtjob → kontrollierter Werkzeugwechsel → .nc → externe Simulation`

Damit ist das CBG-Griffbrett als Referenzfall nicht mehr nur aus zwei getrennten CAM-Programmen bearbeitbar, sondern als zusammenhängender Job.

## Danach

Als nächste getrennte Gates folgen:

- projektweiter Preflight über mehrere Operationen,
- sichere Job-End-/Parkstrategie,
- erst danach optional intelligentere Werkzeuggruppierung.
