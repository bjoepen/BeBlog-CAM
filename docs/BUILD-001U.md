# BeBlog CAM 001U — Facing / Planen

## Ziel

001U schließt den ersten noch fehlenden Bearbeitungsschritt des 0.1-CBG-Headstock-Referenzworkflows: **Planen einer rechteckigen Rohlingoberfläche**.

Planen ist rohlingbasiert. Es benötigt keine Konturauswahl und funktioniert sowohl bei STEP- als auch bei DXF-Projekten, solange ein rechteckiger Rohling definiert ist.

## Operation

Neue Operation: `facing` / **Planen**.

Technische Parameter:

- Werkzeug / Werkzeugdurchmesser
- Bahnausrichtung X oder Y
- seitliche Zustellung als Prozent des Werkzeugdurchmessers
- Planabtrag
- maximale Zustellung je Z-Stufe
- Vorschub
- Eintauchvorschub
- Spindeldrehzahl
- Sicherheits-Z

Standardwerkzeug ist ein Planfräser Ø 20 mm.

## Werkzeugregeln in 001U

- **Planfräser:** bevorzugt und ohne Hinweis zulässig.
- **Schaftfräser:** zulässige Alternative; Preflight gibt einen Hinweis aus.
- **Vollradiusfräser:** für Planen nicht freigegeben.
- **V-/Gravurfräser:** für Planen nicht freigegeben.

Die allgemeine Werkzeug–Operation-Kompatibilitätsmatrix bleibt weiterhin Scope von 001W. 001U prüft ausschließlich die für Planen unmittelbar sicherheitsrelevante Auswahl.

## Werkzeugweg

Der Planpfad ist ein rechteckiger Zickzack-Rasterpfad:

- Bahnen verlaufen wahlweise in X oder Y.
- Der Abstand der Bahnen wird aus Werkzeugdurchmesser × Stepover berechnet.
- Der tatsächliche Abstand wird so verteilt, dass die gegenüberliegende Rohlingkante exakt erreicht wird.
- Entlang der Hauptbewegungsrichtung fährt die Fräsermitte um einen Werkzeugradius über beide Stirnkanten hinaus, damit die vollständige Fläche erfasst wird.
- Zwischen benachbarten Bahnen wird bei Arbeitsvorschub verfahren; es gibt **keine Rapid-Bewegung im Material**.
- Mehrere Z-Stufen werden aus Planabtrag und Zustellung erzeugt.
- Zwischen Z-Stufen wird auf Sicherheits-Z zurückgezogen.

001U setzt Z-Null auf der Rohlingoberseite voraus. WCS Unterseite wird im Preflight blockiert.

## Preflight

Der vorhandene Schritt **Prüfen** bleibt die zentrale Prüfinstanz. Für Planen werden zusätzlich geprüft:

- Rohling vorhanden und gültig
- WCS-Z auf Oberseite
- gültiger Werkzeugdurchmesser
- Stepover > 0 % und ≤ 90 %
- Planabtrag > 0 und nicht größer als Rohlingdicke
- Zustellung > 0
- Vorschub / Eintauchvorschub / Drehzahl > 0
- Sicherheits-Z > 0
- unmittelbar unzulässige Fräsertypen

Planen ist außerdem in den bestehenden Gesamtjob-Preflight integriert.

## G-Code / Postprozessor

001U erzeugt portablen G-Code mit G0/G1 und führt ihn durch die vorhandene Postprozessor-Pipeline. Damit stehen auch die bereits vorhandenen Postprozessoren einschließlich LinuxCNC für Planen zur Verfügung.

Planen ist außerdem im bestehenden Multi-Operation-G-Code-Kern (`jobGcode.ts`) integriert.

## Nicht Bestandteil von 001U

- Helical Bore Milling (001V)
- allgemeine Werkzeug–Operation-Kompatibilitätsmatrix (001W)
- Z-Level Roughing (001X)
- Parallel 3D Finishing (001Y)
- Stock Simulation
- geometrische Halter-/Schaftkollisionen
- probing-basierte WCS-Korrektur

## Gates

### U1 — Operation anlegen

Unter `Bearbeiten` → `+ Bearbeitung` → `Planen` wählen.

Erwartung: Planen erscheint in der Operationsliste und wird aktiv.

### U2 — Rohlingbezug

Mit definiertem rechteckigem Rohling Planen öffnen.

Erwartung: Keine Konturauswahl wird verlangt; die komplette Rohlingfläche wird als Ziel beschrieben.

### U3 — Strategie

Zwischen `Bahnen in X` und `Bahnen in Y` wechseln und den Stepover verändern.

Erwartung: Operationszusammenfassung reagiert; gültiger Bereich 1–90 %, UI empfiehlt praxisnah Werte im vorhandenen Bereich.

### U4 — Werkzeug

Unter `Werkzeuge` einen Planfräser auswählen, Schnittdaten berechnen und explizit in die aktive Planoperation übernehmen.

Erwartung: Werkzeugname, Typ, Durchmesser, Vorschub und Drehzahl kommen in `Bearbeiten` an.

Zusatztest mit Schaftfräser: zulässig, aber WARN im Preflight.

### U5 — Preflight

Unter `Prüfen` kontrollieren:

- Planfräser + gültige Werte → PASS
- Schaftfräser → WARN, aber freigabefähig
- Vollradius-/V-Fräser → FAIL
- `Kein Rohling` → FAIL
- WCS Z Unterseite → FAIL

### U6 — G-Code

Unter `Fräsen` Planen prüfen.

Erwartung:

- Zickzackpfad wird ausgegeben
- keine G0-XY-Bewegung bei negativer Arbeitstiefe
- Werkzeug fährt entlang der Hauptachse um einen Radius über die Rohlingkante
- mehrere Planstufen ziehen dazwischen auf Sicherheits-Z zurück
- Postprozessor-Auswahl bleibt verfügbar
- `.nc` lässt sich speichern

### U7 — Gesamtjob

Mindestens Planen + Kontur oder Tasche anlegen und `Prüfen` öffnen.

Erwartung: Planen erscheint im Gesamtjob-Preflight und beeinflusst PASS/WARN/FAIL wie jede andere Operation.

### U8 — Regression

```bash
pnpm check
pnpm build
```

Danach:

```bash
pnpm tauri dev
```

Zusätzlich prüfen:

- Bauteil öffnen
- Rohling + Material
- Werkzeugbibliothek / vier Fräsertypen
- Kontur
- Tasche
- Carve
- Bohren
- Prüfen
- vorhandene Postprozessoren
- Floh persistent
