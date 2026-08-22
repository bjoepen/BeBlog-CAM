# BeBlog CAM — Build 001I

## Ziel

001I erweitert den in 001H bewiesenen klassischen 2D-CAM-Grundstock `Kontur · Tasche · Carve` um mehrere Bearbeitungen innerhalb eines Projekts.

Referenzbauteil bleibt das reale CBG-Griffbrett:

1. `FRET_SLOTS` → Carve → Ø 0,6 mm,
2. `OUTLINE` → Kontur außen → Ø 3,0 mm.

## Gate 7A — Operationsmodell und Bearbeitungsliste

Status: **PASS / GESCHLOSSEN**

Mehrere Bearbeitungen können angelegt, unabhängig gespeichert, gewechselt und gelöscht werden. Geometrieauswahl, Werkzeug- und Schnittdaten bleiben pro Operation getrennt. Die lineare Hauptnavigation bleibt unverändert.

Verbindlich:

- `operations: CamOperation[]`
- `activeOperationId: string | null`
- aktive Markierung = Editorfokus, nicht Exportauswahl
- jede Operation besitzt eigene Geometrie-, Werkzeug- und Schnittdaten

**Gate 7A = PASS.**

## Gate 7B — Gesamtjob und kontrollierter Werkzeugwechsel

Status: **PASS / GESCHLOSSEN**

Mehrere bewiesene Einzeloperationen werden zu einer gemeinsamen `.nc` verbunden. NC Viewer und CAMotics bestätigten am CBG-Griffbrett Carve der Bundschlitze plus Außenkontur im selben Job.

Unterschiedliche Werkzeuge erzeugen konservativ einen kontrollierten manuellen Halt:

```text
G0 Z<Sicherheits-Z>
M5
( Werkzeugwechsel )
M0 ( Werkzeug ... einsetzen und bestaetigen )
```

Danach startet die nächste Operation mit ihren eigenen Drehzahl- und Schnittdaten. Ein automatischer `M6`-Wechsel wird nicht vorausgesetzt.

**Gate 7B = PASS.**

## Gate 7C — projektweiter Preflight

Status: **PASS / GESCHLOSSEN**

`05 · Prüfen` wechselt bei mehreren Operationen von der Einzelprüfung auf einen echten Gesamtjob-Preflight.

### Sicherheitsregel

**Ein einziges FAIL in einer aktivierten Bearbeitung setzt den gesamten Job auf FAIL.**

WARN wird ebenfalls bis auf Gesamtjob-Ebene hochgereicht. Die aktive Markierung unter `04 · Bearbeiten` beeinflusst die Gesamtprüfung nicht.

### Architektur

- `src/lib/jobPreflight.ts` bündelt die Freigabezustände aller Operationen.
- `src/lib/JobPreflightPanel.svelte` zeigt Gesamtstatus, Einzelstatus und Werkzeugwechsel kompakt an.
- Kontur und Tasche werden mit ihren bewiesenen G-Code-/Geometriekernen geprüft.
- Carve verwendet den bewiesenen Carve-Validator; WCS- und Rohlinghinweise werden auf Job-Ebene ergänzt.
- Werkzeugwechsel werden mit derselben Werkzeugidentität gezählt wie im Gesamtjob-Generator.

### Realtest

Der Gesamtjob des CBG-Griffbretts wurde mit mehreren Operationen erfolgreich geprüft. Die projektweite Prüfung erkennt beide Bearbeitungen unabhängig von der aktuell markierten Operation. Der Werkzeugwechsel ist zusätzlich im exportierten G-Code eindeutig vorhanden und wurde direkt kontrolliert.

Damit ist nachgewiesen:

- mehrere Operationen werden gemeinsam geprüft,
- der Editorfokus beeinflusst die Gesamtprüfung nicht,
- unterschiedliche Werkzeuge erzeugen einen kontrollierten manuellen Halt,
- der Gesamtjob enthält beide zuvor einzeln bewiesenen Werkzeugwege,
- eine einzelne fehlerhafte Operation würde den Gesamtjob blockieren.

**Gate 7C = PASS.**

## Polish — sichere Operationsgrenzen und Carve-Safe-Z

Status: **PASS / GESCHLOSSEN**

Nach Abschluss von Gate 7 wurden die bereits funktionierenden Bewegungssequenzen ausschließlich redaktionell bereinigt, ohne Geometrie, Werkzeugweg oder Zustellungen zu verändern.

### Gesamtjob-Übergänge

Redundante Safe-Z- und `M5`-Sequenzen an Operationsgrenzen wurden entfernt. Der Werkzeugwechsel lautet jetzt eindeutig:

```text
G0 Z5.000
M5
( Werkzeugwechsel 1 )
M0 ( Werkzeug Schaftfräser 3 mm · Ø3.000 mm einsetzen und bestaetigen )
```

### Carve-interner Safe-Z-Polish

Innerhalb des Carve-Pfads wurden doppelte Safe-Z-Befehle zwischen getrennten Bundschlitzen entfernt. Die Sicherheitssemantik bleibt unverändert:

`Safe-Z → XY-Anfahrt → Eintauchen → Centerline → Safe-Z`

Die letzte exportierte Referenz-`.nc` wurde kontrolliert und bestätigt:

- keine redundanten `G0 Z5.000` mehr zwischen Carve-Segmenten,
- sichere Z-Rückzüge bleiben vollständig erhalten,
- Werkzeugwechsel erscheint genau einmal und an der richtigen Stelle,
- Jobende ist sauber: `G0 Z5.000 → M5 → M30`,
- keine Änderung an Centerlines, Zustelltiefen, Reihenfolge oder Konturgeometrie.

**Polish = PASS.**

## Meilenstein — 001I Multi-Operation

Mit 001I besitzt BeBlog CAM erstmals einen vollständig bewiesenen Multi-Operation-Workflow:

`DXF → mehrere Bearbeitungen → unabhängige Geometrie-/Werkzeug-/Schnittdaten → Gesamt-Preflight → kontrollierter Werkzeugwechsel → Gesamtjob .nc → externe Simulation`

Der CBG-Griffbrett-Referenzfall ist damit vollständig abgedeckt:

1. `FRET_SLOTS` → Carve → 16 ausgewählte Bundschlitze → Ø 0,6 mm,
2. sicherer manueller Werkzeugwechsel,
3. `OUTLINE` → Außenkontur → Ø 3,0 mm,
4. gemeinsamer exportierter Job,
5. Prüfung und Simulation als zusammenhängendes Maschinenprogramm.

Die bewiesenen Bewegungssequenzen aus 001H/001I gelten ab diesem Punkt als stabil und werden nicht ohne neues eigenes Gate verändert.

## Weiterer Ausbau

001I ist als Multi-Operation-Meilenstein abgeschlossen. Der weitere Ausbau erfolgt in neuen, getrennten Gates. Naheliegende nächste Themen sind:

- sichere Job-End-/Parkstrategie,
- projektweite Werkzeugverwaltung,
- optionale intelligentere Werkzeuggruppierung,
- weitere 2D-Strategien und Interpolationsfälle,
- konservative Schnittdatenempfehlungen für Hobby-CNCs.
