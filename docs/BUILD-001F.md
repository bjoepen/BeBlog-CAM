# BeBlog CAM — Build 001F

## Meilenstein: erste verifizierte DXF-Kontur bis zum G-Code

**Datum:** 2026-08-18  
**Status:** Gate 5 PASS

Build 001F erreicht erstmals eine vollständige, nachvollziehbare CAM-Kette für eine reale DXF-Konturbearbeitung:

`DXF → Sollkontur → Werkzeugradiuskorrektur → mathematische Bahnprüfung → Zustellungen → WCS-Transformation → G-Code → externer NC-Viewer`

## Verbindlicher Geometriegrundsatz

**Die Koordinaten der CAD-Kontur sind die geometrische Wahrheit.**

Die Sollkontur definiert das Fertigmaß. Werkzeugmittelbahn, Radiuskorrektur, Zustellungen und G-Code werden ausschließlich daraus abgeleitet. Die Werkzeugbahn darf niemals rückwirkend die Sollgeometrie definieren.

Beispiel: Bei einem Fräser Ø 4.000 mm und Bearbeitung `Außen` beträgt der Sollversatz der Werkzeugmittelbahn 2.000 mm nach außen. Das erwartete Fertigmaß der CAD-Kontur bleibt unverändert.

## Gate 4 — mathematische Bahnvermessung: PASS

Der Preflight prüft nicht nur den theoretischen Werkzeugradius, sondern vermisst die tatsächlich erzeugte Werkzeugmittelbahn gegen die gewählte CAD-Kontur.

Geprüft werden insbesondere:

- Sollabstand aus Werkzeugradius,
- tatsächlicher senkrechter Abstand der Bahnsegmente zur Sollkontur,
- maximale Abweichung,
- Parallelität der zugeordneten Segmente,
- korrekte Seite für `Außen` bzw. `Innen`.

Damit ist die sichtbare Vorschau nicht die Instanz, die Maßhaltigkeit behauptet. Die geometrische Prüfung erfolgt numerisch.

## Gate 5 — erste G-Code-Erzeugung: PASS

Für die reale Test-DXF `Mini OX Seitenwange.dxf` wurde erstmals G-Code aus der bereits verifizierten Werkzeugmittelbahn erzeugt und anschließend in einem externen NC-Viewer kontrolliert.

Verifizierter Testfall:

- Werkzeug: Ø 4.000 mm
- Bahn: Außen
- Werkzeugradius: 2.000 mm
- Gesamttiefe: 3.000 mm
- Zustellung: 1.000 mm
- drei Tiefenbahnen: Z -1.000 / -2.000 / -3.000 mm
- Sicherheits-Z: +5.000 mm
- Vorschub: 600 mm/min
- Eintauchvorschub: 200 mm/min
- Drehzahl: 12.000 1/min
- absolute Koordinaten in Millimetern (`G21`, `G90`)
- XY-Ebene (`G17`)

Die ausgegebene Außenbahn erreicht unter anderem X -2.000 mm bzw. Y -2.000 mm und bildet damit für den Testfall den erwarteten Werkzeugradius von 2.000 mm außerhalb der CAD-Sollkontur ab.

Die drei Zustellungen fahren dieselbe XY-Werkzeugmittelbahn auf unterschiedlichen Z-Tiefen. Der externe NC-Viewer stellte die resultierende Kontur und die Tiefenbahnen plausibel und deckungsgleich dar.

## Sicherheitsprinzip

`05 · Prüfen` bleibt ein verbindliches Preflight-Gate vor `06 · Fräsen`.

Ein geometrischer FAIL darf keine G-Code-Erzeugung freigeben. WARN bleibt für bewusst eingeschränkte Prüfbarkeit zulässig, beispielsweise eine DXF-Bearbeitung ohne definierten Rohling; der Hinweis muss jedoch sichtbar bleiben.

**Empfehlung ≠ Freigabe. Prüfen bleibt Pflicht.**

## Bewusste Grenzen von 001F

- Der G-Code wird zunächst als Vorschau erzeugt; Dateiexport folgt nach weiterer Validierung.
- Bögen und Kreise werden aktuell als Folge von `G1`-Segmenten ausgegeben. Eine spätere Ausgabe als echte `G2/G3`-Interpolation ist vorgesehen.
- WCS auf der Unterseite ist für diesen ersten G-Code-Pfad noch gesperrt; die Z-Transformation muss dafür unter Einbeziehung der Materialdicke separat abgesichert werden.
- Mehrere Bearbeitungsoperationen und Werkzeugwechsel sind noch nicht Bestandteil dieses Meilensteins.
- Der konservative Schnittdaten-Assistent für Hobby-CNCs ist als späterer Ausbau von `03 · Werkzeuge` vorgesehen und gehört nicht zum 001F-Gate.

## Bedeutung des Meilensteins

001F ist der erste Build, in dem BeBlog CAM nicht nur Geometrie importiert und darstellt, sondern aus einer realen CAD-Kontur eine radiuskorrigierte und mathematisch geprüfte Werkzeugbahn ableitet, diese in Zustellungen überführt und daraus extern nachvollziehbaren G-Code erzeugt.

Damit ist erstmals die grundlegende CAM-Kette vom CAD-Element bis zur Maschinenbewegung geschlossen.
