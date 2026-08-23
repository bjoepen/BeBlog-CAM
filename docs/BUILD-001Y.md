# BeBlog CAM 001Y — Contour Breakout / Open Contour Machining

## Ziel

001Y erweitert die bestehende **Kontur**-Bearbeitung so, dass eine **geschlossene CAD-Sollkontur gezielt für die Bearbeitung aufgebrochen** werden kann.

Praxisreferenz ist die CBG-Kopfplatte: Die Zeichnung bleibt geschlossen und maßhaltig. Für die Fertigung wird jedoch z. B. die Halsseite abgewählt, sodass nur drei Seiten gefräst werden und die Kopfplatte mit dem Hals verbunden bleibt.

Zusätzlich bleibt die bereits gebaute Unterstützung für tatsächlich offene DXF-Ketten erhalten. Für **Carve** wird die bestehende Centerline-Semantik um `Links / Rechts / Auf Linie` erweitert.

## Leitplanke

**CAD-Geometrie und Bearbeitungsauswahl sind zwei verschiedene Wahrheiten.**

- Die CAD-Kontur bleibt unverändert geschlossen.
- Der Nutzer wählt eine Kontur.
- Danach kann er einzelne Konturstrecken direkt im Viewport aus- oder wieder einschalten.
- Ausgeschaltete Strecken erzeugen keinen Schnitt und keine automatische Ersatzverbindung.
- `Außen / Innen / Auf Linie` bleibt die Werkzeugseitenlogik der ursprünglichen geschlossenen Sollkontur.
- Bei frei gewählten offenen Carve-Linien gilt geometrisch `Links / Rechts / Auf Linie`.

Es entsteht keine neue Bearbeitungsart und kein zusätzlicher Workflow-Schritt.

## Architektur

### Geschlossene Sollkontur aufbrechen

`ContourOperation.excludedSegmentIds` speichert ausschließlich die Bearbeitungsauswahl. Die importierte DXF-Geometrie wird nicht verändert.

`src/lib/brokenContour.ts` zerlegt die aktive geschlossene Kontur an den abgewählten Segmenten in eine oder mehrere zusammenhängende offene Teilkonturen. Für jede aktive Teilkontur wird die Werkzeugradiuskorrektur separat berechnet.

Die Zuordnung von `Außen / Innen` bleibt an der Orientierung der vollständigen geschlossenen Sollkontur gebunden. Dadurch bleibt die Materialseite auch nach dem Aufbrechen eindeutig.

### Werkzeugradiuskorrektur

An offenen Endpunkten wird die Werkzeugbahn nicht mit einer erfundenen vierten Seite vermitert. Der Offset endet an der tatsächlichen offenen Teilkontur.

Geprüft werden Werkzeugradiusabstand, Parallelität, korrekte Seite, Selbstüberschneidung, mindestens eine aktive Konturstrecke und das Fehlen impliziter Verbindungen über ausgeschaltete Bereiche.

### Carve-Seite

`CarveOperation.side` kennt `left | right | on-line`.

Für jede ausgewählte offene DXF-Linie gilt:

- `Auf Linie` → bisheriges Verhalten; die Fräsermittellinie entspricht der CAD-Linie.
- `Links` → Fräsermittellinie liegt exakt einen Werkzeugradius links der Linienrichtung.
- `Rechts` → Fräsermittellinie liegt exakt einen Werkzeugradius rechts der Linienrichtung.

Die Seitenwahl bezieht sich bewusst auf die Richtung der einzelnen offenen DXF-Linie. `Innen / Außen` wäre ohne geschlossene Elternkontur nicht eindeutig.

### G-Code

`src/lib/gcode.ts` bleibt der gemeinsame Einstiegspunkt:

- geschlossene Kontur ohne Ausschlüsse → bewährter geschlossener Kern
- geschlossene Kontur mit Ausschlüssen → `brokenContourGcode.ts`
- tatsächlich offene DXF-Kette → `openContourGcode.ts`

Bei mehreren getrennten aktiven Teilkonturen erfolgt jeder Wechsel ausschließlich auf Sicherheits-Z.

`carveGcode.ts` verwendet für Links/Rechts denselben Werkzeugradius wie Vorschau und Preflight. Auch getrennte Carve-Linien werden weiterhin ausschließlich auf Sicherheits-Z gewechselt.

## UX

Ablauf unter **Bearbeiten → Kontur**:

1. geschlossene Sollkontur auswählen
2. einzelne Konturstrecke anklicken → Strecke wird aus der Bearbeitung genommen
3. erneut anklicken → Strecke wird wieder eingeschaltet
4. `Außen / Innen / Auf Linie` wie gewohnt wählen
5. Gleichlauf / Gegenlauf wie gewohnt wählen

Aktive und ausgeschaltete Strecken werden im Viewport unterschiedlich dargestellt. Die rote Linie zeigt ausschließlich die daraus abgeleitete Fräsermittelbahn.

Unter **Bearbeiten → Carve** erscheint zusätzlich der kompakte Abschnitt **Werkzeugweg** mit `Links / Rechts / Auf Linie`. Die rote Vorschau zeigt den tatsächlichen Fräsermittelweg; die ausgewählte CAD-Linie bleibt als Referenz sichtbar.

## Canvas-Invariante

Die CAM-Overlay-SVG und die Geometrie-SVG müssen exakt denselben 1000×650-Zeichenraum und denselben Mittelpunkt verwenden. Informations-Captions dürfen die Zentrierung des eigentlichen SVG nicht beeinflussen.

Eine Werkzeugbahn `Auf Linie` muss visuell exakt auf der schwarzen Sollgeometrie liegen. Ein sichtbarer globaler Versatz ist FAIL, selbst wenn der NC-Code mathematisch korrekt wäre. Das gilt für Kontur und Carve.

## Prüfen

001Y hängt sich weiterhin in die 001X Validation Grammar ein.

Für aufgebrochene Konturen wird zusätzlich geprüft: geschlossene Sollkontur, mindestens eine abgewählte und mindestens eine aktive Strecke, gültige Werkzeugradiuskorrektur, keine Selbstüberschneidung, Werkzeugkompatibilität, Tiefe, Zustellung, Schnittdaten, Sicherheits-Z und Rohlinghinweise.

Für Carve zeigt der Preflight zusätzlich die gewählte Seite und den erwarteten Offset. `Auf Linie` erwartet 0.000 mm, Links/Rechts exakt den Werkzeugradius.

## Sicherheitsinvarianten

1. Die CAD-Sollkontur wird nie verändert.
2. Eine ausgeschaltete Strecke erzeugt keinen Schnitt.
3. Es wird keine Ersatzverbindung über ausgeschaltete Strecken erzeugt.
4. Außen/Innen bleibt aus der ursprünglichen geschlossenen Kontur abgeleitet.
5. Gleichlauf/Gegenlauf ändert nur die Fahrtrichtung, nicht die Materialseite.
6. Zwischen getrennten Teilkonturen und zwischen Z-Stufen wird vor XY-Verfahrten auf Sicherheits-Z zurückgezogen.
7. Ungültige Offsetgeometrie blockiert G-Code.
8. `Auf Linie` muss im Canvas ohne globalen Darstellungsversatz auf der CAD-Geometrie liegen.
9. Geschlossene Konturen ohne Ausschlüsse behalten ihren bisherigen Kern.
10. Carve Links/Rechts versetzt jede offene Linie exakt um den Werkzeugradius; die CAD-Linie selbst bleibt unverändert.
11. Carve-Segmentwechsel erfolgen weiterhin nur auf Sicherheits-Z.

## Gates

### Y1 — Build

- `pnpm check`
- `pnpm build`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`

Erwartung: keine Fehler.

### Y2 — Geschlossene Kontur Regression

Geschlossene Kontur auswählen, keine Strecke abwählen, G-Code erzeugen. Erwartung: bisheriger Konturpfad unverändert.

### Y3 — Kontur aufbrechen

Ein Rechteck oder die geschlossene CBG-Kopfplattenkontur auswählen und eine Seite anklicken. Erwartung: angeklickte Strecke ist sichtbar ausgeschaltet, CAD bleibt geschlossen, rote Werkzeugbahn enthält die Strecke nicht, kein automatischer Schluss.

### Y4 — Wieder einschalten

Ausgeschaltete Strecke erneut anklicken. Erwartung: vollständige geschlossene Bearbeitung wird wiederhergestellt.

### Y5 — Werkzeugseite

Mit aufgebrochener Kontur nacheinander `Außen`, `Innen`, `Auf Linie` wählen. Erwartung: korrekte Seite; `Auf Linie` deckt sich visuell exakt mit aktiven CAD-Strecken; Außen/Innen entspricht Werkzeugradius.

### Y6 — Richtungsinvariante

Zwischen Gleichlauf und Gegenlauf wechseln. Erwartung: Fahrtrichtung ändert sich, Materialseite und Ausschlüsse nicht.

### Y7 — Preflight

Aufgebrochene Kontur prüfen. Erwartung: PASS bei gültiger Geometrie; FAIL wenn alle Strecken ausgeschaltet sind oder der Offset geometrisch ungültig wird.

### Y8 — NC-Sicherheitsprüfung

Mehrere Z-Stufen erzeugen. Erwartung: keine Schnittverbindung über ausgeschaltete Strecken; getrennte Teilkonturen nur nach Rückzug auf Sicherheits-Z.

### Y9 — Canvas Alignment

`Auf Linie` wählen. Erwartung: rote Werkzeugbahn liegt pixelgenau auf der schwarzen CAD-Kontur. Kein konstanter X/Y-Versatz.

### Y10 — NC View

NC-Datei der CBG-Kopfplatte öffnen. Erwartung: nur die freigegebenen drei Seiten werden bearbeitet; der Halsübergang bleibt ungeschnitten.

### Y11 — Carve Seitenwahl

Eine einzelne DXF-Linie mit bekanntem Verlauf auswählen und nacheinander `Auf Linie`, `Links`, `Rechts` wählen.

Erwartung:

- Auf Linie: rote Bahn deckt sich mit CAD-Linie.
- Links/Rechts: rote Bahn wechselt sichtbar die Seite.
- Abstand entspricht exakt Werkzeugradius.
- Auswahl der Geometrie bleibt unverändert.

### Y12 — Carve NC

Für dieselbe Linie NC-Dateien für `Auf Linie`, `Links`, `Rechts` erzeugen.

Erwartung: Die XY-Koordinaten von Links/Rechts sind gegenüber Centerline um exakt Werkzeugradius normal zur Linienrichtung versetzt. Zwischen mehreren gewählten Linien gibt es keine G1-Verbindung auf Schnitttiefe; Wechsel erfolgen weiterhin über Sicherheits-Z.

## Bewusste Grenzen

Nicht Bestandteil dieses Korrekturlaufs:

- native G2/G3-Erhaltung aufgebrochener ARC-Segmente
- native G2/G3-Carve-Ausgabe für ARC/open-polyline
- STEP-Kanten als auswählbare Teilkonturen
- Tabs/Stege
- Lead-in / Lead-out
- allgemeine 3D Machining Boundary
- Z-Level Roughing

## Real-World-DoD

001Y ist fachlich PASS, wenn eine **geschlossen gezeichnete** CBG-Kopfplattenkontur im CAM an der Halsseite durch Abwahl dieser Strecke geöffnet werden kann, die Vorschau exakt zur CAD-Geometrie ausgerichtet ist und der erzeugte NC-Code keinerlei Schnitt über den geschützten Halsübergang enthält. Zusätzlich müssen Carve-Linien wahlweise auf Linie oder exakt einen Werkzeugradius links/rechts davon gefräst werden können.
