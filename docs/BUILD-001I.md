# BeBlog CAM — Build 001I

## Ziel

001I erweitert den in 001H bewiesenen klassischen 2D-CAM-Grundstock `Kontur · Tasche · Carve` um mehrere Bearbeitungen innerhalb eines Projekts.

Referenzbauteil bleibt das reale CBG-Griffbrett:

1. `FRET_SLOTS` → Carve → Ø 0,6 mm,
2. `OUTLINE` → Kontur außen → Ø 3,0 mm.

## Gate 7A — Operationsmodell und Bearbeitungsliste

Status: **PASS / GESCHLOSSEN**

Mehrere Bearbeitungen können angelegt, unabhängig gespeichert, gewechselt und gelöscht werden. Geometrieauswahl, Werkzeug- und Schnittdaten bleiben pro Operation getrennt. Die lineare Hauptnavigation bleibt unverändert.

**Gate 7A = PASS.**

## Gate 7B — Gesamtjob und kontrollierter Werkzeugwechsel

Status: **PASS / GESCHLOSSEN**

Mehrere bewiesene Einzeloperationen werden zu einer gemeinsamen `.nc` verbunden. NC Viewer und CAMotics bestätigten am CBG-Griffbrett Carve der Bundschlitze plus Außenkontur im selben Job. Unterschiedliche Werkzeuge erzeugen einen kontrollierten manuellen Halt.

**Gate 7B = PASS.**

## Gate 7C — projektweiter Preflight

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

`05 · Prüfen` wechselt bei mehreren Operationen jetzt von der Einzelprüfung auf einen echten Gesamtjob-Preflight.

### Sicherheitsregel

**Ein einziges FAIL in einer aktivierten Bearbeitung setzt den gesamten Job auf FAIL.**

WARN wird ebenfalls bis auf Gesamtjob-Ebene hochgereicht. Die aktive Markierung unter `04 · Bearbeiten` beeinflusst die Gesamtprüfung nicht.

### Architektur

- `src/lib/jobPreflight.ts` bündelt die Freigabezustände aller Operationen.
- `src/lib/JobPreflightPanel.svelte` zeigt Gesamtstatus, Einzelstatus und Werkzeugwechsel kompakt an.
- Kontur und Tasche werden mit ihren bewiesenen G-Code-/Geometriekernen geprüft.
- Carve verwendet den bewiesenen Carve-Validator; WCS- und Rohlinghinweise werden auf Job-Ebene ergänzt.
- Werkzeugwechsel werden mit derselben Werkzeugidentität gezählt wie im Gesamtjob-Generator (`Werkzeugname + Durchmesser`).

### Realtest

Gate 7C benötigt zwei Prüfungen am CBG-Griffbrett:

1. **Positivtest:** Carve `FRET_SLOTS` + Außenkontur `OUTLINE` müssen gemeinsam als freigabefähig erscheinen; ohne Rohling ist WARN zulässig und erwartet.
2. **Negativtest:** In genau einer Operation wird absichtlich ein sicherheitsrelevanter Fehler erzeugt, z. B. Zustellung `0 mm`. Der Gesamtjob muss sofort auf **FAIL** wechseln und die verursachende Bearbeitung eindeutig benennen.

Erst nach beiden Tests wird Gate 7C geschlossen.

## Danach

Nach Gate 7C folgen getrennt:

- sichere Job-End-/Parkstrategie,
- erst danach optional intelligentere Werkzeuggruppierung.
