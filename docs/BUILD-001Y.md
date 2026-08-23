# BeBlog CAM 001Y — Open Contour Machining

## Ziel

001Y erweitert die bestehende **Kontur**-Bearbeitung um offene DXF-Ketten. Es entsteht ausdrücklich keine neue Bearbeitungswelt.

Praxisreferenz ist die CBG-Kopfplatte: Die Kopfplattenkontur darf an drei Seiten gefräst werden, während der Übergang zum Hals offen und damit ungeschnitten bleibt.

## Leitplanke

**Eine Konturwelt, zwei Topologien:**

- geschlossen
- offen

Eine offene Kontur darf niemals implizit zwischen ihrem letzten und ersten Punkt geschlossen werden.

## Architektur

### Offene Ketten

`src/lib/openContour.ts` baut verbundene offene Chains aus nativen DXF-Linien, Bögen und offenen Polylinien auf. Anfang und Ende bleiben explizit verschieden.

### Werkzeugseite

Für offene Konturen existieren drei Seitenzustände:

- links
- rechts
- auf Linie

Links/Rechts beziehen sich auf die feste Richtung der DXF-Kette. Die spätere Fahrtrichtung Gleichlauf/Gegenlauf darf diese gewählte Materialseite nicht invertieren.

### Werkzeugradiuskorrektur

`offsetOpenChain()` erzeugt eine offene Fräsermittelbahn im Abstand des Werkzeugradius. Sie prüft:

- Abstand zur Sollkette
- Parallelität
- korrekte Seite
- Selbstüberschneidung
- offene Endpunkte

### G-Code

`src/lib/gcode.ts` bleibt der gemeinsame Einstiegspunkt für Kontur-G-Code und routet anhand der Topologie:

- geschlossen → bewährter geschlossener Konturkern
- offen → `openContourGcode.ts`

Der offene Pfad wird zunächst bewusst als überprüfbare G1-Bahn ausgegeben. Native G2/G3-Erhaltung offener Bögen ist nicht Teil von 001Y.

## UX

Es gibt keinen neuen `+ Bearbeitung`-Button.

Unter **Bearbeiten → Kontur** werden geschlossene und offene Konturen im Viewport angeboten. Bei einer offenen Kette erscheinen die beiden radiuskorrigierten Seiten als dezente Vorschau. Der Nutzer klickt direkt auf die gewünschte Werkzeugseite; ein Klick auf die Centerline wählt `Auf Linie`.

Die rote Werkzeugweg-Vorschau bleibt sichtbar und muss an beiden Enden offen bleiben.

## Prüfen

001Y hängt sich in die mit 001X vereinheitlichte Prüfung ein.

Zusätzliche offene Konturprüfungen:

- offene Kontur ausgewählt
- Werkzeugdurchmesser > 0
- gültige Tiefen und Schnittdaten
- gültiger Sicherheits-Z
- Werkzeug–Operation-Kompatibilität aus der gemeinsamen Validation Grammar
- mathematisch gültiger Offset
- keine Selbstüberschneidung
- Rohling-/Tiefenhinweise

Im Gesamtjob wird die offene Kontur über denselben `jobPreflight` wie alle anderen Operationen geprüft.

## Sicherheitsinvarianten

1. Eine offene Kontur wird niemals automatisch geschlossen.
2. Es wird kein Schnitt vom letzten Endpunkt zurück zum ersten Endpunkt erzeugt.
3. Links/Rechts ist an die DXF-Kettenrichtung gebunden, nicht an Gleichlauf/Gegenlauf.
4. Zwischen Z-Stufen wird vor dem Rückweg zum Startpunkt auf Sicherheits-Z gefahren.
5. Ungültige Offsetgeometrie darf keinen G-Code erzeugen.
6. Geschlossene Konturen und Taschen behalten ihren bestehenden 001X-Prüf- und Werkzeugwegkern.

## Gates

### Y1 — Build

- `pnpm check`
- `pnpm build`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`

Erwartung: keine Fehler.

### Y2 — Geschlossene Kontur Regression

Eine vorhandene geschlossene Außenkontur auswählen und G-Code erzeugen.

Erwartung: bisheriger geschlossener Konturpfad unverändert funktionsfähig.

### Y3 — Offene Kette erkennen

Eine DXF mit einer dreiseitigen, zusammenhängenden offenen Kopfplattenkontur laden.

Erwartung:

- Kette erscheint als offene Auswahlgeometrie.
- Anfang und Ende bleiben sichtbar getrennt.
- keine künstliche vierte Seite.

### Y4 — Werkzeugseite wählen

Links- und Rechts-Vorschau im Viewport nacheinander anklicken.

Erwartung:

- rote Werkzeugbahn wechselt auf die jeweilige Seite.
- Abstand entspricht Werkzeugradius.
- `Auf Linie` liegt exakt auf der DXF-Kette.

### Y5 — Richtungsinvariante

Eine Werkzeugseite wählen und danach zwischen Gleichlauf und Gegenlauf wechseln.

Erwartung: Die Fahrtrichtung ändert sich, die gewählte Werkzeug-/Materialseite nicht.

### Y6 — Preflight

Gültige offene Kontur mit Schaftfräser prüfen.

Erwartung: PASS bzw. nur bekannte Rohling-Hinweise. Ein ungeeigneter Werkzeugtyp folgt der 001X-Kompatibilitätsmatrix.

### Y7 — NC-Sicherheitsprüfung

G-Code für mehrere Z-Stufen erzeugen.

Erwartung:

- jede Stufe beginnt am offenen Startpunkt
- Schnitt endet am offenen Endpunkt
- danach `G0 Z...` auf Sicherheits-Z
- keine XY-Rückfahrt zum Startpunkt auf Schnitttiefe
- keine Zeile erzeugt eine Verbindung Endpunkt → Startpunkt

### Y8 — NC View

NC-Datei in NC View öffnen.

Erwartung: ausschließlich die ausgewählten Seiten der Kopfplatte werden bearbeitet; der Halsübergang bleibt offen.

## Bewusste Grenzen

Nicht Bestandteil von 001Y:

- native G2/G3-Ausgabe für offene ARC-Ketten
- STEP-Kanten als offene 2D-Kontur auswählen
- Tabs/Stege
- Lead-in / Lead-out
- 3D Machining Boundary
- Z-Level Roughing

Die offene Konturgeometrie ist jedoch bewusst als Grundlage für spätere Bearbeitungsgrenzen vorgesehen.

## Real-World-DoD

001Y ist fachlich PASS, wenn die CBG-Kopfplattenkontur an drei Seiten als echte offene Kontur bearbeitet werden kann, die gewählte Werkzeugseite korrekt bleibt und weder Vorschau, Preflight noch NC-Code den Halsübergang schließen.
