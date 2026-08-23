# BeBlog CAM 001X — Unified Preflight Grammar

## Ziel

001X vereinheitlicht den bestehenden Schritt **Prüfen**, ohne einen zweiten Validator oder eine neue Prüf-Welt aufzubauen.

Die vorhandenen, bewiesenen geometrischen Einzelprüfungen bleiben erhalten. Ergänzt wird eine gemeinsame Validation Grammar für wiederkehrende Regeln:

**Geometrie → Werkzeug → Strategie → Tiefe → Schnittdaten → Setup → Rohling → Werkzeugweg**

## Architektur

- `src/lib/validationGrammar.ts` enthält gemeinsame Prüfbegriffe, Levels und Werkzeug-Kompatibilitätsregeln.
- Die geometrischen Spezialvalidatoren bleiben Source of Truth für ihre jeweilige Operation.
- `jobPreflight.ts` aggregiert die Spezialvalidatoren und ergänzt die gemeinsame Grammar.
- PASS / WARN / FAIL bleibt die verbindliche Statusgrammatik.
- Ein FAIL in einer aktiven Bearbeitung setzt den Gesamtjob auf FAIL.
- WARN bleibt freigabefähig, beschreibt aber eine fachlich nicht ideale oder noch nicht vollständig modellierte Situation.

## Werkzeug-Kompatibilität

### Planen

- Planfräser: PASS
- Schaftfräser: WARN, technisch zulässig
- Vollradiusfräser: FAIL
- V-Fräser: FAIL

### Kontur

- Schaftfräser: PASS
- Vollradiusfräser: WARN, Konturgrund verändert sich
- Planfräser: FAIL
- V-Fräser: FAIL, da die aktuelle Radiuskorrektur keine variable V-Geometrie modelliert

### Tasche

- Schaftfräser: PASS
- Vollradiusfräser: WARN, kein ebener Taschenboden
- Planfräser: FAIL
- V-Fräser: FAIL
- Helix-Eintauchen: ausschließlich Schaftfräser PASS

### Bohren

Axial:
- nicht typisiertes Werkzeug: PASS; wird als klassischer Bohrer behandelt
- Schaftfräser: WARN, da die Bibliothek die Eigenschaft „zenterschneidend“ noch nicht kennt
- Planfräser / Vollradiusfräser / V-Fräser: FAIL

Helixfräsen:
- Schaftfräser: PASS
- alle anderen Typen: FAIL

### Carve

- Schaftfräser: PASS für den heutigen Centerline-Pfad
- V-Fräser: WARN; Centerline möglich, aber V-Geometrie / Gravurbreite noch nicht modelliert
- Vollradiusfräser: WARN; Centerline möglich, Nutform noch nicht bewertet
- Planfräser: FAIL

## Gemeinsame Setup-Regeln

Die Grammar prüft für jede aktive Bearbeitung konsistent:

- Werkzeugdurchmesser > 0
- Tiefe / Planabtrag > 0
- Zustellung > 0
- Vorschub > 0
- Eintauchvorschub > 0
- Drehzahl > 0
- Sicherheits-Z > 0
- WCS-Z auf Rohlingoberseite für die heute freigegebenen 2D/2,5D-Pfade
- Rohling vorhanden bzw. WARN bei rohlingloser Bearbeitung, soweit zulässig
- Bearbeitungstiefe gegen Rohlingdicke

## Bewusste Grenze

001X behauptet **keine echte geometrische Kollisionsprüfung**. Aussagen zu Material- oder Kollisionsgrenzen bleiben eingeschränkt, solange keine Stock-Simulation mit Werkzeug/Schaft/Halter-Geometrie existiert.

Die spätere geometrische Kollisionsprüfung baut auf Stock Simulation auf und bleibt ein eigener Roadmap-Punkt.

## UI-Regel

Benutzertexte in `Prüfen` sollen fachlich formuliert sein und keine Build-Archäologie wie „Gate 6C“, „001U-Regel“ oder „in 001V noch nicht freigegeben“ benötigen. Buildnummern gehören in Entwicklungsdokumentation, nicht in die fachliche Entscheidung des Nutzers.

## Gates

### X1 — Kein zweites Prüfsystem

PASS wenn die geometrischen Einzelvalidatoren weiterverwendet werden und 001X nur gemeinsame Regeln ergänzt.

### X2 — Gesamtjob

PASS wenn jede aktive Bearbeitung mit Spezialvalidator + Validation Grammar geprüft wird und ein einziges FAIL den Gesamtjob auf FAIL setzt.

### X3 — Planen

Planfräser PASS, Schaftfräser WARN, Vollradius/V-Fräser FAIL.

### X4 — Helix

Helixbohren und Kreistaschen-Helix benötigen einen Schaftfräser. Andere Werkzeugtypen müssen FAIL ergeben.

### X5 — Kontur / Tasche

Planfräser und V-Fräser dürfen nicht stillschweigend als normale radiuskorrigierte 2D-Werkzeuge akzeptiert werden.

### X6 — Carve

V-Fräser bleibt zunächst WARN statt PASS, weil die variable V-Geometrie noch nicht Teil des mathematischen Carve-Modells ist.

### X7 — Setup

Ungültige Tiefe, Zustellung, Schnittdaten, Safe-Z oder WCS müssen konsistent FAIL ergeben. Tiefe über Rohlingdicke ist für die meisten 2D/2,5D-Pfade WARN; Planen bleibt FAIL.

### X8 — Regression

Unverändert funktionieren müssen:

- Planen
- Kontur außen / innen / auf Linie
- Raster-, Kreis- und konturparallele Taschen
- Kreistaschen-Helix aus 001W
- axiales Bohren
- Helixbohren aus 001V
- Carve
- Gesamtjob
- Postprozessoren

## Manuelle Abnahme

1. je eine Operation Planen, Kontur, Tasche, Carve und Bohren anlegen;
2. unter `Prüfen` PASS/WARN/FAIL vergleichen;
3. Werkzeugtypen bewusst falsch zuordnen;
4. Helix mit Nicht-Schaftfräser muss FAIL sein;
5. Planen mit Schaftfräser muss WARN, nicht FAIL sein;
6. V-Fräser bei Carve muss WARN sein;
7. Safe-Z = 0 muss FAIL sein;
8. WCS-Z Unterseite muss für die heutigen Bearbeitungen FAIL sein;
9. Multi-Operation-Job: ein einziges FAIL muss Gesamtjob FAIL ergeben.

## Leitplanke

> Prüfen ist eine Instanz, keine Sammlung unabhängiger Ampeln. Geometrische Wahrheit bleibt beim jeweiligen CAM-Kern; gemeinsame Regeln werden genau einmal fachlich definiert.
