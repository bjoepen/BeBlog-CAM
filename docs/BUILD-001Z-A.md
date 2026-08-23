# BeBlog CAM 001Z-A — Z-Level Geometry Kernel

## Ziel

001Z-A führt noch keine 3D-Schruppbearbeitung und keinen G-Code ein. Der Build beweist zuerst, dass BeBlog CAM aus der vorhandenen STEP-Darstellungs-Triangulation reproduzierbare horizontale Z-Schnittkonturen ableiten und im 3D-Viewport sichtbar machen kann.

Das exakte OCCT-BRep bleibt Source of Truth. Die Triangulation ist hier ausdrücklich eine abgeleitete Repräsentation für den ersten kontrollierten Z-Level-Geometry-Kernel; sie ersetzt weder BRep noch spätere CAM-Geometrie.

## Datenfluss

`STEP → OCCT BRep → Darstellungs-Triangulation → horizontale Schnitte → Segment-Deduplizierung → zusammenhängende 2D-Ketten je Z-Ebene → 3D-Overlay`

## Kernel-Regeln

- Z-Ebenen werden von der Modelloberseite aus mit einer frei einstellbaren Zustellung erzeugt.
- Die Unterkante des Modells wird als letzte Ebene aufgenommen, sofern sie nicht bereits durch das Raster getroffen wird.
- Dreiecke, die vollständig koplanar zur Schnittebene liegen, erzeugen nicht blind drei Schnittsegmente.
- Schnitte an gemeinsamen Dreieckskanten werden dedupliziert.
- Einzelne Schnittsegmente werden über gemeinsame Endpunkte zu Ketten verbunden.
- Geschlossene Ketten werden als solche markiert; offene Ketten bleiben offen und werden niemals künstlich geschlossen.
- Der Kernel erzeugt noch keine Werkzeugradiuskorrektur, Räumstrategie oder Maschinenbewegung.

## UI / Visual Gate

Im STEP-Viewport gibt es eine lokale Schaltfläche `Z-Level`.

Bei aktiver Vorschau:

- `Zustellung` bestimmt den Abstand der horizontalen Ebenen.
- Die abgeleiteten Schnittkonturen werden orange über dem ruhigen BRep-Modell dargestellt.
- Die Anzeige nennt Anzahl Ebenen und abgeleitete Konturketten.
- Orbit, Pan, Zoom, Rohling, WCS und echte BRep-Kanten bleiben erhalten.

## Real-World-Abnahme

Referenz: `CBG Headstock v1.step`.

1. Start mit `pnpm native:dev`.
2. STEP laden; Referenzdaten bleiben 16 Flächen, 72 Kanten, 2 Volumenkörper.
3. `Z-Level` einschalten.
4. Zunächst 2,0 mm Zustellung wählen.
5. Die orange Geometrie muss ausschließlich auf horizontalen Schnitten durch das reale Modell liegen.
6. Bohrungen und Außenform müssen abhängig von der jeweiligen Z-Höhe in den Schnittkonturen erscheinen bzw. verschwinden.
7. Keine orange Verbindung darf durch Bereiche entstehen, in denen das Modell auf dieser Z-Ebene nicht existiert.
8. Zustellung auf z. B. 1,0 mm und 5,0 mm ändern; Anzahl der Ebenen muss plausibel reagieren.
9. Kamera drehen und zoomen; die Z-Schnitte müssen geometrisch am Modell haften.

## FAIL-Kriterien

- Konturen schweben sichtbar neben dem Modell.
- Offene Schnittketten werden stillschweigend geschlossen.
- Schnitte verbinden getrennte Modellbereiche künstlich.
- identische Segmente erscheinen mehrfach als sichtbare Dublette.
- Aktivieren der Vorschau verändert Modell-, Rohling- oder WCS-Geometrie.
- irgendein G-Code oder eine Bearbeitungsoperation wird aus 001Z-A erzeugt.

## Ausdrücklich noch nicht enthalten

- Stock-minus-Part-Berechnung
- Machining Boundary / geschützter Halsübergang
- Werkzeugradius
- Stepover
- Z-Level-Räumstrategie
- Restmaterial
- G-Code
- Simulation / Kollision

Diese Punkte folgen erst, wenn der Geometrie-Gate mit dem realen Referenzmodell bestanden ist.
