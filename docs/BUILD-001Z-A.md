# BeBlog CAM 001Z-A — Z-Level Roughing Geometry & Toolpath Preview

## Ziel

001Z-A erzeugt weiterhin noch keinen Maschinen-G-Code. Der Build beweist den praxisnahen Geometrie- und Toolpath-Weg für eine 3-Achs-Schruppbearbeitung am STEP-Modell:

`Rohlingoberkante → gewählte horizontale BRep-Zielfläche → Schlichtaufmaß → gestufte Abtragszone → Werkzeugradius + Stepover → sichtbarer Toolpath`

Das exakte OCCT-BRep bleibt Source of Truth. Triangulation und Face-IDs sind abgeleitete Daten für Darstellung und Selektion.

## Praxisfall CBG-Kopfplatte

Der reale Referenzfall ist eine eingespannt bleibende Kopfplatte. Die seitlichen Überstände des Rohlings dürfen ausdrücklich stehen bleiben. Der Nutzer wählt die obere Fläche der Kopfplatte als Zielfläche. BeBlog CAM darf nur den XY-Bereich dieser Fläche von der Rohlingoberkante bis auf die Zielhöhe plus Schlichtaufmaß abtragen.

Damit lautet die Semantik:

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
- Zielfläche: 15,0 mm
- Schlichtaufmaß: 0,5 mm
- Schrupp-Endhöhe: 15,5 mm

Die spätere Schlichtoperation entfernt erst das verbleibende Aufmaß bis zur echten Fläche.

## Werkzeugbahn-Vorschau

`src/lib/faceTargetToolpath.ts` erzeugt aus der gültigen Face-Target-Roughing-Zone eine konservative Rasterstrategie.

Berücksichtigt werden:

- Werkzeugdurchmesser,
- Werkzeugradius als Sicherheitsabstand zur äußeren und inneren Boundary,
- Stepover in Prozent des Werkzeugdurchmessers,
- alle berechneten Z-Ebenen,
- innere Öffnungen als verbotene Bereiche.

Die Preview ist noch keine vollständige Maschinenbewegung: An-/Abfahrbewegungen, Rapids und Postprozessor-spezifische Details folgen später.

## Kanonischer Toolpath-Vertrag

Mit `src/lib/canonicalToolpath.ts` führt 001Z-A einen gemeinsamen Toolpath-Vertrag ein. Der Roughing-Kernel erzeugt nicht länger ein rein darstellungsspezifisches Ergebnis, sondern ein kanonisches Toolpath-Objekt mit:

- stabiler Vertragsversion,
- Operationstyp,
- Strategie,
- Werkzeugdaten,
- Stepover,
- geordneten Cutting-Runs mit Z-Höhe und XY-Punkten.

Dieser Vertrag ist künftig die gemeinsame Grundlage für:

`Operation → kanonischer Toolpath → Viewport → Prüfen → Postprozessor`

Damit gilt verbindlich: **No blind toolpaths.** Eine Bearbeitung darf nicht erst im erzeugten G-Code sichtbar werden. Die im Viewport gezeigte Werkzeugbahn muss aus derselben kanonischen Toolpath-Geometrie stammen, die später geprüft und vom Postprozessor verarbeitet wird.

Der spätere Rollout auf Planen, Kontur, Tasche, Carve sowie Bohren/Helix erfolgt in einem eigenen Schritt nach Abschluss von 001Z-A.

## Farbsemantik

- **Ocker** = Auswahl / Bearbeitungsbereich / Roughing-Zone
- **Petrol** = tatsächliche Werkzeugbahn

Diese Trennung ist bewusst operationsübergreifend angelegt.

## UI / Visual Gate

Im STEP-Viewport gibt es weiterhin den lokalen Schalter `Z-Level`.

Bei aktiver Vorschau:

- `Zustellung` definiert den vertikalen Abstand der Schruppstufen,
- `Schlichtaufmaß` definiert den Materialrest über der gewählten Zielfläche,
- `Werkzeug Ø` definiert den Werkzeugdurchmesser,
- `Stepover` definiert den Bahnabstand,
- ohne Auswahl fordert die Anzeige zur Wahl einer Zielfläche auf,
- mit gültiger Auswahl werden Ziel-Z und Schrupp-Endhöhe angezeigt,
- ockerfarbene transparente Flächen zeigen ausschließlich den freigegebenen Abtragsbereich,
- petrolfarbene Linien zeigen die berechneten Werkzeugmittelpunktbahnen,
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
7. Seitliche Rohlingüberstände bleiben frei und damit als Spannmaterial erhalten.
8. Bohrungs-/Öffnungsbereiche innerhalb der Zielfläche bleiben ausgespart.
9. Standard-Schlichtaufmaß 0,5 mm: letzte Roughing-Ebene liegt 0,5 mm oberhalb der echten Modellfläche.
10. Werkzeugdurchmesser z. B. 6 mm und Stepover 40 % wählen.
11. Petrolfarbene Werkzeugmittelpunktbahnen müssen innerhalb der freigegebenen Zone bleiben und ausreichenden Werkzeugradius-Abstand zu Außenrand und Öffnungen halten.
12. Änderung von Zustellung, Schlichtaufmaß, Werkzeugdurchmesser oder Stepover muss die Vorschau unmittelbar aktualisieren.
13. Orbit/Pan/Zoom dürfen Auswahl, Zielhöhe und Toolpath-Geometrie nicht verändern.
14. Auswahl löschen entfernt Roughing-Zone und Werkzeugbahn wieder.

## FAIL-Kriterien

- Roughing-Zonen decken den kompletten Rohling statt nur die gewählte Zielfläche ab.
- seitliche Rohlingüberstände werden als zu entfernendes Material markiert.
- Zielfläche wird bis auf ihre echte Modellhöhe geschruppt, obwohl ein positives Schlichtaufmaß gesetzt ist.
- innere Öffnungen werden ungefragt geräumt.
- Werkzeugmittelpunktbahnen verletzen Außenrand oder innere Öffnungen.
- eine nicht horizontale Fläche erzeugt stillschweigend eine Roughing-Zone.
- Auswahl markiert nur einzelne Mesh-Dreiecke.
- Orbit/Drag verändert die Auswahl.
- Vorschau reagiert erst nach einer Kamerabewegung.
- irgendein G-Code wird aus 001Z-A erzeugt.

## Ausdrücklich noch nicht enthalten

- An-/Abfahrbewegungen und Rapids,
- Restmaterialmodell,
- G-Code / Postprozessor-Anbindung,
- Simulation / Kollision auf Basis des neuen Toolpath-Vertrags,
- finale Schlichtoperation,
- Rollout des kanonischen Toolpath-Vertrags auf die vorhandenen 2D-Operationen.

Diese Punkte folgen erst, wenn der ausgewählte Face-Target-Roughing- und Toolpath-Preview-Gate am realen CBG-Referenzteil bestanden und stabil ist.
