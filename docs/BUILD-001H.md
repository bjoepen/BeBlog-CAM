# BeBlog CAM — Build 001H

## Ziel

001H führt die erste echte Taschenoperation ein, ohne den in 001G bewiesenen Konturpfad zu verändern.

Produktregel:

**Die linke Workflow-Leiste bleibt unverändert. Tasche ist eine Bearbeitung innerhalb `04 · Bearbeiten`, kein neuer Hauptschritt.**

## Gates 1–3

**PASS.** Taschenmodell, UX und mathematischer Rechtecktaschen-Preflight sind verifiziert. Die CAD-Kontur bleibt das Fertigmaß; Werkzeugradius, Stepover, Flächenabdeckung und Z-Zustellungen werden vor Maschinen-Code geprüft.

## Gate 4 — Taschen-G-Code und `.nc`

Status: **PASS / GESCHLOSSEN**  
Geschlossen: **2026-08-19**

Der bewiesene Referenzpfad lautet:

`DXF-Sollkontur → radiuskorrigierte Taschenfläche → Rasterstrategie → Preflight → Z-Zustellungen → Wandumlauf → .nc → CAMotics`

Die von BeBlog CAM erzeugte `.nc` wurde in CAMotics erfolgreich simuliert. Vollständige Rasterräumung, Zustellfolge und Wandumlauf wurden bestätigt.

### Gate-4-Polish

Der geschlossene Wandumlauf wird zyklisch auf den geometrisch nächstgelegenen gültigen Startpunkt rotiert. Endet die Rasterbahn bereits dort, entfällt eine unnötige Positionierfahrt. Der korrigierte Export wurde erneut in CAMotics bestätigt.

Verbindliche Toolpath-Regel:

**Geschlossene Folgepfade sollen am bereits erreichten oder geometrisch nächstgelegenen gültigen Startpunkt beginnen, sofern Geometrie und Bearbeitungsrichtung dadurch unverändert bleiben.**

Eine allgemeine End-of-Job-/Parkstrategie bleibt bewusst einem späteren job-/postprozessorweiten Schritt vorbehalten.

## Gate 5 — lineare Rampenzustellung

Status: **PASS / GESCHLOSSEN**  
Geschlossen: **2026-08-19**

Für den geplanten realen Frästest steht neben senkrechtem Eintauchen nun eine mathematisch kontrollierte lineare Rampe zur Verfügung.

### Sicherheitsregeln

- Die Rampe liegt vollständig auf dem ersten zur Taschenräumung gehörenden Rastersegment.
- Der Rampenwinkel ist ein expliziter Operationsparameter.
- Die benötigte horizontale Rampenlänge wird analytisch aus der jeweiligen Z-Zustellung berechnet:

  `L = ΔZ / tan(α)`

- Die Rampe wird nur freigegeben, wenn `L` vollständig auf das erste Rastersegment passt.
- Passt sie nicht, meldet `05 · Prüfen` FAIL; es wird keine verkürzte oder steilere Ersatzrampe erfunden.
- Für jede Z-Ebene wird nur die zusätzliche Zustelltiefe `ΔZ` verrampt. Bei einer kleineren letzten Zustellung wird entsprechend eine kürzere Rampe berechnet.
- Die vorhandene senkrechte Gate-4-Strategie bleibt unverändert verfügbar.

### G-Code-Strategie

Bei `Rampe` fährt der Fräser vom Rasterstart entlang des ersten Rastersegments gleichzeitig in XY und Z auf die neue Solltiefe. Anschließend wird das verbleibende erste Rastersegment mit normalem Vorschub beendet und die bewiesene Gate-4-Räumung fortgesetzt.

Für Folgeebenen wird zunächst kontrolliert auf die bereits vollständig geräumte vorherige Z-Ebene abgesenkt; nur die neue Materialzustellung erfolgt über die Rampe.

### Positivtest

Referenzfall:

- Zustellung `ΔZ = 1.000 mm`
- Rampenwinkel `5°`

Analytisch ergibt sich:

`L = 1 / tan(5°) ≈ 11.430 mm`

Der erzeugte G-Code verwendet diese Strecke direkt als kombinierte XY/Z-Bewegung. Die resultierenden Rampen wurden in CAMotics auf allen Z-Ebenen sauber und sichtbar dargestellt. Die nachfolgende Rasterräumung und der Wandumlauf bleiben unverändert.

### Negativtest

Mit `1°` Rampenwinkel ergibt sich bei `ΔZ = 1.000 mm` eine benötigte Rampenlänge von `57.290 mm`.

Auf der ersten Rasterbahn stehen im Referenzfall jedoch nur `47.000 mm` zur Verfügung. `05 · Prüfen` meldet deshalb korrekt:

`FAIL — Rampe benötigt 57.290 mm, auf der ersten Rasterbahn stehen aber nur 47.000 mm zur Verfügung.`

Damit ist bestätigt, dass BeBlog CAM unpassende Rampenparameter nicht stillschweigend verändert, sondern die Bearbeitung vor G-Code-Ausgabe sperrt.

### Gate-5-Abschluss

Positivtest, externe CAMotics-Simulation und Negativtest sind bestanden.

**Gate 5 = PASS.**

Der freigegebene Taschenpfad lautet damit nun:

`DXF-Sollkontur → radiuskorrigierte Taschenfläche → Rasterstrategie → Preflight → senkrechtes Eintauchen ODER analytisch geprüfte lineare Rampe → Z-Zustellungen → Wandumlauf → .nc → CAMotics`

Neue Taschenstrategien müssen diesen Pfad über eigene Regression-Gates erweitern, nicht ersetzen.
