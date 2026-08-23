# BeBlog CAM 001Z-A — Z-Level Geometry Kernel

## Ziel

001Z-A führt noch keine 3D-Schruppbearbeitung und keinen G-Code ein. Der Build beweist zuerst, dass BeBlog CAM aus der vorhandenen STEP-Darstellungs-Triangulation reproduzierbare horizontale Z-Schnittkonturen ableiten, echte BRep-Flächen auswählbar machen und die Geometrievorschau im 3D-Viewport sichtbar eingrenzen kann.

Das exakte OCCT-BRep bleibt Source of Truth. Die Triangulation ist hier ausdrücklich eine abgeleitete Repräsentation für den ersten kontrollierten Z-Level-Geometry-Kernel; sie ersetzt weder BRep noch spätere CAM-Geometrie.

## Datenfluss

`STEP → OCCT BRep → Face-IDs + Darstellungs-Triangulation → optionale Face-Auswahl → horizontale Schnitte → Segment-Deduplizierung → zusammenhängende 2D-Ketten je Z-Ebene → 3D-Overlay`

## Kernel-Regeln

- Z-Ebenen werden von der Modelloberseite aus mit einer frei einstellbaren Zustellung erzeugt.
- Die Unterkante des Modells wird als letzte Ebene aufgenommen, sofern sie nicht bereits durch das Raster getroffen wird.
- Dreiecke, die vollständig koplanar zur Schnittebene liegen, erzeugen nicht blind drei Schnittsegmente.
- Schnitte an gemeinsamen Dreieckskanten werden dedupliziert.
- Einzelne Schnittsegmente werden über gemeinsame Endpunkte zu Ketten verbunden.
- Geschlossene Ketten werden als solche markiert; offene Ketten bleiben offen und werden niemals künstlich geschlossen.
- Der Kernel erzeugt noch keine Werkzeugradiuskorrektur, Räumstrategie oder Maschinenbewegung.

## BRep-Face-Auswahl

OCCT liefert für jedes Darstellungsdreieck zusätzlich die ID der echten BRep-Fläche, aus der dieses Dreieck stammt. Die ID ist innerhalb eines Imports deterministisch und dient nur der Viewport-Auswahl; das BRep selbst bleibt die Geometriequelle.

Bei aktiver Z-Level-Vorschau:

- eine sichtbare Modellfläche kann direkt angeklickt werden,
- Mehrfachauswahl ist möglich,
- erneuter Klick entfernt die Fläche wieder,
- gewählte Flächen werden zurückhaltend ocker hervorgehoben,
- `Auswahl löschen` stellt den Zustand `Gesamtmodell` wieder her,
- Orbit/Pan bleiben erhalten; eine echte Drag-Bewegung darf keine Fläche umschalten.

Ohne ausgewählte Flächen schneidet die Vorschau weiterhin das Gesamtmodell. Sobald mindestens eine Fläche gewählt ist, wird der aktuelle Geometry-Proof auf die Dreiecke dieser BRep-Flächen begrenzt. Das ist ausdrücklich **noch keine finale Machining Boundary** und noch keine Stock-minus-Part-Region. Die Face-Auswahl dient in 001Z-A als kontrollierter Selektions- und Geometrie-Gate für den späteren Roughing-Bereich.

## UI / Visual Gate

Im STEP-Viewport gibt es eine lokale Schaltfläche `Z-Level`.

Bei aktiver Vorschau:

- `Zustellung` bestimmt den Abstand der horizontalen Ebenen.
- Die abgeleiteten Schnittkonturen werden orange über dem ruhigen BRep-Modell dargestellt.
- Die Anzeige nennt Anzahl Ebenen, abgeleitete Konturketten und den Auswahlstatus.
- Orbit, Pan, Zoom, Rohling, WCS und echte BRep-Kanten bleiben erhalten.
- Aktivieren/Deaktivieren sowie eine Änderung der Zustellung müssen die Vorschau unmittelbar neu berechnen; eine Kamerabewegung darf dafür nicht erforderlich sein.

## Real-World-Abnahme

Referenz: `CBG Headstock v1.step`.

1. Start mit `pnpm native:dev`.
2. STEP laden; Referenzdaten bleiben 16 Flächen, 72 Kanten, 2 Volumenkörper.
3. `Z-Level` einschalten. Die orange Vorschau muss sofort erscheinen, ohne das Modell zu bewegen.
4. Zunächst 2,0 mm Zustellung wählen.
5. Die orange Geometrie muss ausschließlich auf horizontalen Schnitten durch das reale Modell liegen.
6. Bohrungen und Außenform müssen abhängig von der jeweiligen Z-Höhe in den Schnittkonturen erscheinen bzw. verschwinden.
7. Eine sichtbare BRep-Fläche anklicken. Die gesamte reale Fläche — nicht nur ein einzelnes Mesh-Dreieck — muss hervorgehoben werden.
8. Eine zweite Fläche hinzufügen und eine gewählte Fläche wieder abwählen; Mehrfachauswahl und Toggle müssen stabil funktionieren.
9. Bei aktiver Auswahl muss sich die Z-Level-Geometrievorschau auf die gewählten Face-Dreiecke beschränken. `Auswahl löschen` muss wieder das Gesamtmodell verwenden.
10. Keine orange Verbindung darf durch Bereiche entstehen, in denen die jeweilige Geometrie auf dieser Z-Ebene nicht existiert.
11. Zustellung auf z. B. 1,0 mm und 5,0 mm ändern; Anzahl der Ebenen muss unmittelbar und plausibel reagieren.
12. Kamera drehen und zoomen; die Z-Schnitte und die Face-Auswahl müssen geometrisch am Modell haften. Ein Orbit-Drag darf keine Fläche versehentlich umschalten.

## FAIL-Kriterien

- Konturen schweben sichtbar neben dem Modell.
- Offene Schnittketten werden stillschweigend geschlossen.
- Schnitte verbinden getrennte Modellbereiche künstlich.
- identische Segmente erscheinen mehrfach als sichtbare Dublette.
- Face-Auswahl markiert nur ein einzelnes Tessellationsdreieck statt der zugehörigen BRep-Fläche.
- Orbit/Drag schaltet unbeabsichtigt Flächen um.
- Z-Level erscheint erst nach einer Kamerabewegung.
- Aktivieren der Vorschau verändert Modell-, Rohling- oder WCS-Geometrie.
- irgendein G-Code oder eine Bearbeitungsoperation wird aus 001Z-A erzeugt.

## Ausdrücklich noch nicht enthalten

- Stock-minus-Part-Berechnung
- finale Machining Boundary / geschützter Halsübergang
- Werkzeugradius
- Stepover
- Z-Level-Räumstrategie
- Restmaterial
- G-Code
- Simulation / Kollision

Diese Punkte folgen erst, wenn der Geometrie- und Selektions-Gate mit dem realen Referenzmodell bestanden ist.
