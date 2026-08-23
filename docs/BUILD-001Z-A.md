# BeBlog CAM 001Z-A — Z-Level Geometry Kernel

## Ziel

001Z-A erzeugt weiterhin noch keinen Maschinen-G-Code. Der Build beweist den praxisnahen Geometrieweg für eine 3-Achs-Schruppbearbeitung am STEP-Modell:

`Rohlingoberkante → gewählte horizontale BRep-Zielfläche → Schlichtaufmaß → gestufte Abtragszone`

Das exakte OCCT-BRep bleibt Source of Truth. Triangulation und Face-IDs sind abgeleitete Daten für Darstellung und Selektion.

## Praxisfall CBG-Kopfplatte

Der reale Referenzfall ist eine eingespannt bleibende Kopfplatte. Die seitlichen Überstände des Rohlings dürfen ausdrücklich stehen bleiben. Der Nutzer wählt die obere Fläche der Kopfplatte als Zielfläche. BeBlog CAM darf nur den XY-Bereich dieser Fläche von der Rohlingoberkante bis auf die Zielhöhe plus Schlichtaufmaß abtragen.

Damit lautet die Semantik nicht mehr „Rohling minus Gesamtmodell komplett freiräumen“, sondern:

`gewählte Zielfläche = Bearbeitungsbereich + Zielhöhe`

## BRep-Face-Auswahl

- sichtbare echte BRep-Flächen sind im Z-Level-Modus anklickbar,
- eine Auswahl markiert die vollständige BRep-Fläche und niemals nur ein Tessellationsdreieck,
- Mehrfachauswahl bleibt möglich,
- erneuter Klick wählt eine Fläche ab,
- Orbit/Drag darf keine Fläche versehentlich umschalten,
- ausgewählte Flächen bleiben ruhig ocker hervorgehoben.

Für den Roughing-Proof müssen die ausgewählten Flächen horizontal und planar sowie bei Mehrfachauswahl koplanar sein. Nicht passende Auswahl erzeugt keine Abtragsvorschau.

## Face-Target-Roughing-Kernel

`src/lib/faceTargetRoughing.ts` leitet aus den Darstellungsdreiecken der ausgewählten BRep-Fläche deren äußere und innere XY-Randketten ab. Gemeinsame Dreieckskanten werden verworfen; nur echte Randkanten bleiben übrig. Dadurch bleiben Öffnungen innerhalb der Zielfläche als Aussparungen erhalten und werden nicht automatisch zu Z-Level-Bearbeitungen.

Der Kernel bestimmt:

- Zielhöhe `targetZ` aus der gewählten horizontalen Fläche,
- Schrupp-Endhöhe `roughBottomZ = targetZ + Schlichtaufmaß`,
- Rohlingoberkante aus `stock.thickness`,
- Z-Ebenen zwischen Rohlingoberkante und Schrupp-Endhöhe anhand der Zustellung,
- denselben ausgewählten XY-Bearbeitungsbereich auf jeder dieser Ebenen.

## Schlichtaufmaß

Das Schlichtaufmaß bleibt bewusst oberhalb der echten Modellfläche stehen.

Beispiel:

- Rohlingoberkante: 20,0 mm
- Zielfläche: 12,0 mm
- Schlichtaufmaß: 0,5 mm
- Schrupp-Endhöhe: 12,5 mm

Die spätere Schlichtoperation entfernt erst das verbleibende Aufmaß bis zur echten Fläche.

## UI / Visual Gate

Im STEP-Viewport gibt es weiterhin den lokalen Schalter `Z-Level`.

Bei aktiver Vorschau:

- `Zustellung` definiert den vertikalen Abstand der Schruppstufen,
- `Schlichtaufmaß` definiert den Materialrest über der gewählten Zielfläche,
- ohne Auswahl fordert die Anzeige zur Wahl einer Zielfläche auf,
- mit gültiger Auswahl werden Ziel-Z und Schrupp-Endhöhe angezeigt,
- die ockerfarbenen transparenten Flächen zeigen ausschließlich den Bereich über der gewählten Zielfläche,
- seitliche Rohlingüberstände bleiben unberührt,
- innere Öffnungen der gewählten Fläche bleiben ausgespart,
- Orbit, Pan, Zoom, Rohling, WCS und echte BRep-Kanten bleiben erhalten.

## Real-World-Abnahme

Referenz: `CBG Headstock v1.step`.

1. Start mit `pnpm native:dev`.
2. STEP laden; Referenzdaten bleiben 16 Flächen, 72 Kanten, 2 Volumenkörper.
3. `Z-Level` einschalten; ohne Auswahl darf noch keine Roughing-Zone erscheinen.
4. Große horizontale Oberseite der Kopfplatte anklicken.
5. Die vollständige BRep-Fläche wird ocker markiert.
6. Die Roughing-Zone erscheint ausschließlich über der XY-Projektion dieser Fläche.
7. Seitliche Rohlingüberstände bleiben frei von Roughing-Zonen und damit als Spannmaterial erhalten.
8. Bohrungs-/Öffnungsbereiche innerhalb der Zielfläche bleiben ausgespart und werden nicht automatisch geräumt.
9. Bei 2,0 mm Zustellung müssen plausible Stufen von der Rohlingoberkante bis zur Schrupp-Endhöhe entstehen.
10. Standard-Schlichtaufmaß 0,5 mm: letzte Roughing-Ebene liegt 0,5 mm oberhalb der echten Modellfläche.
11. Änderung von Zustellung oder Schlichtaufmaß muss die Vorschau unmittelbar aktualisieren.
12. Orbit/Pan/Zoom dürfen Auswahl, Zielhöhe und Geometrie nicht verändern.
13. Auswahl löschen entfernt die Face-Target-Roughing-Vorschau wieder.

## FAIL-Kriterien

- Roughing-Zonen decken den kompletten Rohling statt nur die gewählte Zielfläche ab.
- seitliche Rohlingüberstände werden als zu entfernendes Material markiert.
- Zielfläche wird bis auf ihre echte Modellhöhe geschruppt, obwohl ein positives Schlichtaufmaß gesetzt ist.
- innere Öffnungen werden ungefragt zugeräumt.
- eine nicht horizontale Fläche erzeugt stillschweigend eine Roughing-Zone.
- Auswahl markiert nur einzelne Mesh-Dreiecke.
- Orbit/Drag verändert die Auswahl.
- Vorschau reagiert erst nach einer Kamerabewegung.
- irgendein G-Code wird aus 001Z-A erzeugt.

## Ausdrücklich noch nicht enthalten

- Werkzeugradiuskorrektur
- Stepover / eigentliche Räumbahnen
- An-/Abfahrbewegungen
- Restmaterialmodell
- G-Code
- Simulation / Kollision
- finale Schlichtoperation

Diese Punkte folgen erst, wenn der ausgewählte Face-Target-Roughing-Proof am realen CBG-Referenzteil bestanden ist.
