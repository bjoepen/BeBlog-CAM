# Build 011-G3B — STEP BRep Null-Safety

## Ursache und Datenpfad

Der native OCCT-C++-Adapter schreibt analytische Kreisattribute (`center`, `axisDirection`, `radiusMm`) nur für Kreiskanten. Rust deserialisiert diese Felder in `ManufacturingEdgeSummary` als `Option<T>`. Anders als `degeneratedPoint` besitzen diese drei Felder kein `skip_serializing_if`, daher serialisiert der Tauri/Rust-Rückweg `Option::None` als explizites JSON-`null`.

Der Datenpfad lautet:

`occt_bridge.cpp` → `BrepSummary` / `ManufacturingEdgeSummary` in Rust → Tauri-JSON → `ImportSummary.brep` → `buildStepManufacturingFeatureSource()` → orientierte Manufacturing Source → G1-Inventar.

Die TypeScript-Source-Schnittstelle modellierte die normalisierte interne Form (`undefined`/fehlend), übernahm aber zuvor die nativen Objekte unverändert. Dadurch blieb bei einer Linienkante `center: null` erhalten. `boundaryOnZ()` im G1-Inventar prüfte ausschließlich auf `undefined` und dereferenzierte anschließend `edge.center[2]`.

## Datenvertrag

- Für Nicht-Kreiskanten sind `center`, `axisDirection` und `radiusMm` optional. Native `null`-Werte bedeuten dort „nicht vorhanden“.
- Für Kreiskanten sind dieselben Attribute Pflichtwerte. Sie müssen endliche Geometrie, eine normierte Achse und einen positiven Radius liefern; `null` bleibt ein Validierungsfehler.
- `start`, `end`, IDs, Topologie und Degenerated-Semantik bleiben Pflichtwerte.
- `degeneratedPoint` behält den bestehenden 008H-A24-A8-Vertrag: Rust lässt `None` bei der Serialisierung aus; ein expliziter Wert an einer nicht degenerierten Kante bleibt widersprüchlich und wird abgewiesen.
- Vorhandene, aber fehlerhafte optionale Attribute werden nicht stillschweigend entfernt. Nicht-endliche/falsch geformte Mittelpunkte oder Achsen sowie nicht positive Radien erzeugen kontrollierte Validierungsfehler.

## Korrektur

`buildStepManufacturingFeatureSource()` besitzt nun eine explizite native Eingangsform, die Rust-JSON-Nullwerte abbildet. Nach erfolgreicher Validierung werden Faces und Edges in die bestehende kanonische interne Source normalisiert. Optionale Nullwerte werden dort ausgelassen; downstream erhalten G1, Kontur-, Pocket- und Side-Face-Helfer weiterhin ausschließlich validierte interne Geometrie.

`boundaryOnZ()` verwendet zusätzlich null-sichere Prüfungen für Mittelpunkt und Kreisachse. Toleranzen, Closure-Regeln und Feature-Erkennung wurden nicht verändert.

Es wurde kein pauschales `try/catch` eingeführt. Ungültige Pflichtgeometrie läuft über den bestehenden strukturierten G1-Fehlerpfad. Die G3-Pipeline setzt dann keine Klassifikation fort, und `buildStepAdvisorFeatureOverview()` liefert den vorhandenen expliziten Unavailable-Zustand statt einer partiellen oder alten Übersicht.

## Regressionstests

`check:011g1` verwendet realitätsnahe, per JSON round-trip erzeugte Fixtures mit expliziten `null`-Feldern und prüft:

- gültige Linien mit `center`, `axisDirection` und `radiusMm` als `null`;
- unveränderte Feature-IDs, Referenzen und Messwerte;
- kontrollierte Fehler für jedes erforderliche Kreisattribut als `null`;
- kontrollierte Fehler für einen ungültigen Pflicht-Endpunkt;
- unveränderte Produktionsauswahl- und Toolpath-Grenzen.

`check:011g3` führt die reale G1 → G2 → Feasibility → G3-Produzentenpipeline mit denselben Rust-typischen Nullwerten aus. Zusätzlich wird ein ungültiges Kreisattribut ohne Exception bis zum strukturierten Advisor-Unavailable-Ergebnis geprüft.

Der bestehende `check:008h-a24-a8` schützt weiterhin den separaten Degenerated-Point-Nullability-Vertrag.

## Verbleibende manuelle UI-Prüfung

Die separate Abnahme mit `CBG Headstock v1.step` muss noch bestätigen, dass **Prüfen** in WebKit geöffnet werden kann, die Feature-Übersicht erscheint und keine Konsolenexception entsteht. Bei tatsächlich ungültiger Pflichtgeometrie muss die UI stattdessen die verständliche G1/G2-Unavailable-Meldung anzeigen. Diese reale Datei ist nicht Bestandteil des Repositories und wird daher nicht in den automatisierten Fixtures dupliziert.
