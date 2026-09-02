# BeBlog CAM 001Z-A — Canonical Drilling & Helix Toolpaths

## Ziel

Dieser Teilblock führt Bohren und Helixfräsen in denselben kanonischen Toolpath-Vertrag wie die bereits migrierten 2D/2.5D-Operationen.

Verbindliche Pipeline:

`Operation → kanonischer Toolpath → Vorschau / Prüfen → Postprozessor`

Damit gilt auch für Bohren und Helix: **No blind toolpaths.** Die Maschinenbewegung darf nicht aus einer zweiten, von der sichtbaren Werkzeugbahn unabhängigen Geometrie entstehen.

## Bestehende Fachlogik bleibt erhalten

Die bewährten 001V-/001W-Regeln bleiben Source of Truth für die Fertigungssemantik:

- axiales Bohren verwendet explizite G0/G1-Bewegungen und keine Canned Cycles,
- mehrere Zustellungen bleiben möglich,
- Helixfräsen verwendet die gemeinsame Helixprimitive aus `helicalMotion.ts`,
- Helixradius = Bohrungsradius minus Werkzeugradius,
- Helix-Zustellung wird in mm/U angegeben,
- der Fertigumlauf auf Endtiefe bleibt erhalten,
- Pocket-Helix und Bohrungs-Helix teilen weiterhin dieselbe Helixmathematik.

Der neue Teilblock ersetzt diese Mathematik nicht. Er hebt die daraus resultierende Bewegungsgeometrie in den kanonischen Vertrag.

## Erweiterter kanonischer Vertrag

`CanonicalSpatialSegment` kann jetzt zusätzlich explizite Rapid-Bewegungen tragen:

- `rapid3` — sichere G0-Bewegung im Raum,
- `line3` — lineare G1-Bewegung mit optionalem Vorschub,
- `arc3` — G2/G3-Bogen mit XY-Zentrum und gleichzeitig möglicher Z-Änderung.

Für Bohren/Helix wird die geordnete Maschinenbewegung in `CanonicalToolpath.motions` abgelegt.

Neue Semantik:

- `operationKind: drill`
- `strategy: drill` für axiales Bohren
- `strategy: helical-bore` für Helixfräsen

Damit wird insbesondere eine Helix nicht als bloßes Methoden-Flag gespeichert. Die tatsächlichen 3D-Bögen inklusive Z-Zustellung sind Teil der kanonischen Geometrie.

## Routing

Einzeloperation:

`DrillGCodePanel → generateCanonicalDrillGcode → canonical toolpath → canonical post → Postprozessor`

Gesamtjob:

`jobGcode → generateCanonicalDrillGcode → operationBody → Gesamtjob`

Der bisherige `generateDrillGcode` bleibt zunächst als bewiesener Geometrie-/Validierungskern erhalten. Seine geprüfte Bewegungsfolge wird in den kanonischen Vertrag dekodiert und anschließend ausschließlich aus diesem Vertrag wieder als Maschinenbahn ausgegeben. Das entspricht dem bereits für Carve verwendeten Migrationsmuster und vermeidet eine parallele Neuimplementierung der Fertigungslogik.

## Abnahme — axiales Bohren

1. Eine oder mehrere DXF-Kreisbohrungen auswählen.
2. Methode `Bohren` wählen.
3. Bei einer Zustellung muss je Bohrung gelten:
   - Safe-Z,
   - XY-Rapid zur Bohrposition,
   - G1 bis Zieltiefe,
   - Rapid zurück auf Safe-Z.
4. Bei mehreren Zustellungen müssen die bisherigen Zwischenrückzüge erhalten bleiben.
5. Reihenfolge der Bohrungen bleibt die bestehende nearest-neighbour-Reihenfolge.
6. Tiefe, Vorschub und Safe-Z müssen gegenüber dem bisherigen 001V-Pfad geometrisch unverändert bleiben.

## Abnahme — Helixfräsen

1. Einen nativen DXF-Kreis wählen, dessen Durchmesser größer als der Werkzeugdurchmesser ist.
2. Methode `Helixfräsen` wählen.
3. Werkzeugmittelpunkt startet am rechten Tangentialpunkt der Helixbahn.
4. Die Helix besteht weiterhin aus G3-Halbkreisen mit simultaner Z-Zustellung.
5. Jede Umdrehung darf maximal die eingestellte Helix-Zustellung abtragen.
6. Die letzte Umdrehung endet exakt auf Zieltiefe.
7. Anschließend erfolgt der bestehende Fertigumlauf auf Endtiefe.
8. Danach Rapid auf Safe-Z.
9. Radius, Drehrichtung, Z-Verlauf und Fertigumlauf müssen geometrisch dem bisherigen 001V-/001W-Pfad entsprechen.

## FAIL-Kriterien

- `DrillGCodePanel` umgeht den kanonischen Pfad und ruft direkt den Maschinenpost auf.
- der Gesamtjob verwendet für Bohren einen anderen Pfad als die Einzeloperation.
- Helix wird nur als Metadatum gespeichert, ohne ihre echten 3D-Bögen abzubilden.
- simultane Z-Änderung eines G2/G3-Bogens geht beim kanonischen Roundtrip verloren.
- Rapid-, Zustell- oder Rückzugsbewegungen ändern unbemerkt ihre Geometrie.
- Helixradius oder Drehrichtung ändern sich gegenüber dem bewiesenen Bestandspfad.
- Postprozessor erhält eine andere Maschinengeometrie als die kanonische Bewegung.

## Noch offen nach diesem Teilblock

- grafische Darstellung der räumlichen Bohr-/Helixbewegung im Prüfen-Viewport,
- explizite geometrische Kollisionsprüfung dieser Bewegungen,
- vollständige Ablösung der temporären G-Code-zu-kanonisch-Migrationsadapter durch direkte kanonische Strategiekerne, falls dies nach Abschluss des 001Z-A-Rollouts sinnvoll ist.
