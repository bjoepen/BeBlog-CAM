# BeBlog CAM 001Y — Contour Breakout / Open Contour Machining

## Ziel

001Y erweitert die bestehende **Kontur**-Bearbeitung so, dass eine **geschlossene CAD-Sollkontur gezielt für die Bearbeitung aufgebrochen** werden kann.

Praxisreferenz ist die CBG-Kopfplatte: Die Zeichnung bleibt geschlossen und maßhaltig. Für die Fertigung wird jedoch z. B. die Halsseite abgewählt, sodass nur drei Seiten gefräst werden und die Kopfplatte mit dem Hals verbunden bleibt.

Zusätzlich bleibt die bereits gebaute Unterstützung für tatsächlich offene DXF-Ketten erhalten.

## Leitplanke

**CAD-Geometrie und Bearbeitungsauswahl sind zwei verschiedene Wahrheiten.**

- Die CAD-Kontur bleibt unverändert geschlossen.
- Der Nutzer wählt eine Kontur.
- Danach kann er einzelne Konturstrecken direkt im Viewport aus- oder wieder einschalten.
- Ausgeschaltete Strecken erzeugen keinen Schnitt und keine automatische Ersatzverbindung.
- `Außen / Innen / Auf Linie` bleibt die Werkzeugseitenlogik der ursprünglichen geschlossenen Sollkontur.

Es entsteht keine neue Bearbeitungsart und kein zusätzlicher Workflow-Schritt.

## Architektur

### Geschlossene Sollkontur aufbrechen

`ContourOperation.excludedSegmentIds` speichert ausschließlich die Bearbeitungsauswahl. Die importierte DXF-Geometrie wird nicht verändert.

`src/lib/brokenContour.ts` zerlegt die aktive geschlossene Kontur an den abgewählten Segmenten in eine oder mehrere zusammenhängende offene Teilkonturen. Für jede aktive Teilkontur wird die Werkzeugradiuskorrektur separat berechnet.

Die Zuordnung von `Außen / Innen` bleibt an der Orientierung der vollständigen geschlossenen Sollkontur gebunden. Dadurch bleibt die Materialseite auch nach dem Aufbrechen eindeutig.

### Werkzeugradiuskorrektur

An offenen Endpunkten wird die Werkzeugbahn nicht mit einer erfundenen vierten Seite vermitert. Der Offset endet an der tatsächlichen offenen Teilkontur.

Geprüft werden:

- Werkzeugradiusabstand
- Parallelität
- korrekte Seite
- Selbstüberschneidung
- mindestens eine aktive Konturstrecke
- keine implizite Verbindung über ausgeschaltete Bereiche

### G-Code

`src/lib/gcode.ts` bleibt der gemeinsame Einstiegspunkt:

- geschlossene Kontur ohne Ausschlüsse → bewährter geschlossener Kern
- geschlossene Kontur mit Ausschlüssen → `brokenContourGcode.ts`
- tatsächlich offene DXF-Kette → `openContourGcode.ts`

Bei mehreren getrennten aktiven Teilkonturen erfolgt jeder Wechsel ausschließlich auf Sicherheits-Z.

## UX

Ablauf unter **Bearbeiten → Kontur**:

1. geschlossene Sollkontur auswählen
2. einzelne Konturstrecke anklicken → Strecke wird aus der Bearbeitung genommen
3. erneut anklicken → Strecke wird wieder eingeschaltet
4. `Außen / Innen / Auf Linie` wie gewohnt wählen
5. Gleichlauf / Gegenlauf wie gewohnt wählen

Aktive und ausgeschaltete Strecken werden im Viewport unterschiedlich dargestellt. Die rote Linie zeigt ausschließlich die daraus abgeleitete Fräsermittelbahn.

## Canvas-Invariante

Die CAM-Overlay-SVG und die Geometrie-SVG müssen exakt denselben 1000×650-Zeichenraum und denselben Mittelpunkt verwenden. Informations-Captions dürfen die Zentrierung des eigentlichen SVG nicht beeinflussen.

001Y enthält deshalb einen Layout-Fix: Die GeometryView-Caption wird aus dem Zentrierungsfluss genommen. Eine Werkzeugbahn `Auf Linie` muss visuell exakt auf der schwarzen Sollgeometrie liegen. Ein sichtbarer globaler Versatz ist FAIL, selbst wenn der NC-Code mathematisch korrekt wäre.

## Prüfen

001Y hängt sich weiterhin in die 001X Validation Grammar ein.

Für aufgebrochene Konturen wird zusätzlich geprüft:

- geschlossene Sollkontur vorhanden
- mindestens eine Strecke abgewählt
- mindestens eine Strecke aktiv
- gültige Werkzeugradiuskorrektur aller aktiven Teilkonturen
- keine Selbstüberschneidung
- Werkzeugkompatibilität
- Tiefe / Zustellung / Schnittdaten / Sicherheits-Z
- Rohlinghinweise

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

## Gates

### Y1 — Build

- `pnpm check`
- `pnpm build`
- `cargo check --locked --manifest-path src-tauri/Cargo.toml`

Erwartung: keine Fehler.

### Y2 — Geschlossene Kontur Regression

Geschlossene Kontur auswählen, keine Strecke abwählen, G-Code erzeugen.

Erwartung: bisheriger Konturpfad unverändert.

### Y3 — Kontur aufbrechen

Ein Rechteck oder die geschlossene CBG-Kopfplattenkontur auswählen und eine Seite anklicken.

Erwartung:

- angeklickte Strecke wird sichtbar ausgeschaltet
- CAD-Kontur bleibt sichtbar geschlossen
- rote Werkzeugbahn enthält die ausgeschaltete Strecke nicht
- kein automatischer Schluss zwischen den neuen Endpunkten

### Y4 — Wieder einschalten

Ausgeschaltete Strecke erneut anklicken.

Erwartung: vollständige geschlossene Bearbeitung wird wiederhergestellt.

### Y5 — Werkzeugseite

Mit aufgebrochener Kontur nacheinander `Außen`, `Innen`, `Auf Linie` wählen.

Erwartung:

- Werkzeugbahn wechselt korrekt auf die jeweilige Seite
- `Auf Linie` deckt sich visuell exakt mit den aktiven CAD-Strecken
- Abstand bei Außen/Innen entspricht Werkzeugradius

### Y6 — Richtungsinvariante

Zwischen Gleichlauf und Gegenlauf wechseln.

Erwartung: Fahrtrichtung ändert sich, gewählte Materialseite und ausgeschaltete Strecken nicht.

### Y7 — Preflight

Aufgebrochene Kontur prüfen.

Erwartung: PASS bei gültiger Geometrie; FAIL wenn alle Strecken ausgeschaltet sind oder der Offset geometrisch ungültig wird.

### Y8 — NC-Sicherheitsprüfung

Mehrere Z-Stufen erzeugen.

Erwartung:

- keine G1/G2/G3-Verbindung über ausgeschaltete Strecken
- getrennte Teilkonturen werden nur nach `G0 Z<Sicherheits-Z>` gewechselt
- kein Rückweg über den geschützten Halsübergang auf Schnitttiefe

### Y9 — Canvas Alignment

`Auf Linie` wählen.

Erwartung: rote Werkzeugbahn liegt pixelgenau auf der schwarzen CAD-Kontur. Kein konstanter X/Y-Versatz.

### Y10 — NC View

NC-Datei der CBG-Kopfplatte öffnen.

Erwartung: nur die freigegebenen drei Seiten werden bearbeitet; der Halsübergang bleibt ungeschnitten.

## Carve-Folgethema

Der Hinweis `Innen / Außen / Auf Linie` für Carve ist aufgenommen. Für frei ausgewählte offene Carve-Linien ist `Innen/Außen` ohne eine zugehörige geschlossene Referenzkontur jedoch semantisch nicht eindeutig. Dieser Ausbau soll deshalb nicht als bloßer UI-Schalter erfolgen: entweder `Links / Rechts / Auf Linie` für echte offene Linien oder `Innen / Außen / Auf Linie`, wenn die Carve-Auswahl auf eine geschlossene Elternkontur bezogen ist.

## Bewusste Grenzen

Nicht Bestandteil dieses Korrekturlaufs:

- native G2/G3-Erhaltung aufgebrochener ARC-Segmente
- STEP-Kanten als auswählbare Teilkonturen
- Tabs/Stege
- Lead-in / Lead-out
- allgemeine 3D Machining Boundary
- Z-Level Roughing

## Real-World-DoD

001Y ist fachlich PASS, wenn eine **geschlossen gezeichnete** CBG-Kopfplattenkontur im CAM an der Halsseite durch Abwahl dieser Strecke geöffnet werden kann, die Vorschau exakt zur CAD-Geometrie ausgerichtet ist und der erzeugte NC-Code keinerlei Schnitt über den geschützten Halsübergang enthält.
