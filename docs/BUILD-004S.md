# Build 004S — Machine Envelope & Safe Motion Preflight v1

## Ziel
BeBlog CAM muss vor der Ausgabe erkennen, ob kanonische Werkzeugbewegungen nach Transformation vom Werkstück-Koordinatensystem (WCS) in reale Maschinenkoordinaten außerhalb des verfügbaren Maschinenarbeitsraums liegen.

004S folgt auf 004Q/004R: Werkzeugbaugruppe und Spannmittel sind bereits modelliert; jetzt wird der reale Achsarbeitsraum zur zusätzlichen Sicherheitsgrenze.

## Vertrag v1

### Maschinenarbeitsraum
Ein Maschinenprofil definiert harte Grenzen für X/Y/Z (`min`/`max`) sowie einen optionalen Warnabstand zum Grenzbereich.

### WCS in Maschinenkoordinaten
Toolpaths bleiben im CAM-WCS. 004S prüft sie **nicht** direkt gegen Maschinenlimits, sondern transformiert jeden geprüften Punkt über eine explizite WCS-Ursprungsposition in Maschinenkoordinaten.

### Bewertung
- außerhalb harter X/Y/Z-Grenzen → **FAIL**
- innerhalb des konfigurierten Warnabstands → **WARN**
- vollständig innerhalb der Grenzen → **PASS**
- ungültige Maschinen-/WCS-Daten → **FAIL statt Schätzung**

### Geprüfte Bewegungen
1. Wenn `CanonicalToolpath.motions` vorhanden ist, wird diese explizite Maschinenbewegungskette bevorzugt.
2. Andernfalls prüft 004S alle Run-Punkte plus vorhandene Entry-/Exit-Spatial-Motions.
3. Der konfigurierte Sicherheits-Z-Wert wird separat gegen die Z-Grenzen geprüft.
4. Fehlt eine vollständige canonical-motions-Kette, wird das sichtbar als Hinweis ausgegeben. 004S v1 behauptet dann ausdrücklich **keine vollständige Rapid-Swept-Simulation**.

## Noch nicht Teil von 004S v1
- automatische Ermittlung der WCS-Maschinenposition aus Controller/Probe
- Maschinenkinematik außerhalb kartesischer XYZ-Achsen
- Spindelnase/Z-Achsen-Schlitten als Kollisionskörper
- vollständige Job-Level-Swept-Solid-Simulation aller Rapids
- Endschalter-/Homing-Controllerkommunikation

## Geplante Integration nach Kernel-Gate
- Maschinenprofil in Setup/Maschineneinstellungen
- WCS-Maschinenposition im Setup
- Job-Preflight PASS/WARN/FAIL
- derselbe 004S-Preflight sperrt NC-Export bei Grenzverletzung

## Lokale Gates
```bash
pnpm check:004s
pnpm check
pnpm build
```

Keine Änderung am nativen OCCT-Import. `pnpm native:test` ist für 004S v1 nicht erforderlich.
