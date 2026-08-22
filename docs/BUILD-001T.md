# BeBlog CAM 001T — Tool Type Model & Adaptive Tool Data

## Ziel

001T macht den Fräsertyp zu einer echten technischen Eigenschaft des Werkzeugs. Die Werkzeugerfassung beginnt mit der Typauswahl; anschließend zeigt BeBlog CAM nur die für diesen Fräser erforderlichen technischen Daten.

Unterstützte Fräsertypen:

1. Schaftfräser
2. Vollradiusfräser
3. Planfräser
4. Gravur / V-Fräser

Der bestehende Bohr-Workflow bleibt unverändert. Ein Bohrer ist keine der vier Fräserarten und wird deshalb in 001T nicht künstlich in dieses Modell gezwungen.

## Typabhängige technische Daten

### Schaftfräser

- Werkzeugdurchmesser
- Schneidenzahl
- Zahnvorschub
- Schneidenlänge
- Schaftdurchmesser

### Vollradiusfräser

- Werkzeugdurchmesser
- Schneidenzahl
- Zahnvorschub
- Schneidenlänge
- Schaftdurchmesser
- Kugelradius wird aus `d / 2` abgeleitet

### Planfräser

- Werkzeugdurchmesser
- Schneiden bzw. Schneidplatten
- Zahnvorschub
- maximale technische Schnitttiefe `ap`

`ap` ist in 001T eine Werkzeuggrenze und verändert keine CAM-Zustellung automatisch.

### Gravur / V-Fräser

- Spitzenwinkel
- Spitzendurchmesser
- maximaler Durchmesser
- Schneidenzahl
- Zahnvorschub

Für die bestehende Schnittdatenrechnung wird in 001T der maximale Werkzeugdurchmesser als Rechendurchmesser verwendet. Die tiefenabhängige wirksame Schneidenbreite wird erst zusammen mit einer späteren V-Carve-Strategie eingeführt.

## Datenmodell

`src/lib/toolTypes.ts` enthält eine diskriminierte Union aus vier Werkzeugtypen. Gemeinsame Zerspanungsdaten bleiben gemeinsam, typabhängige Geometrie ist nur dort vorhanden, wo sie technisch sinnvoll ist.

Der Werkzeugtyp wird beim Übernehmen in die Schnittdaten-Pipeline mitgeführt. Bestehende Operationslogik darf ihn in 001T noch ignorieren; dadurch bleibt der bisherige CAM-Workflow kompatibel und der Typ steht für spätere Strategie-/Kompatibilitätsprüfungen bereit.

## Werkzeugbibliothek und Migration

Die bestehende Local-Storage-Bibliothek verwendet weiterhin `beblog-cam.tool-library.v1`, damit Nutzer keine getrennte Bibliothek erhalten.

Alte 001S-Einträge ohne Fräsertyp werden beim Laden automatisch als **Schaftfräser** migriert. Durchmesser, Schneidenzahl und Zahnvorschub bleiben erhalten. Für die neuen Pflichtfelder werden konservative geometrische Defaultwerte ergänzt.

Werkstoffdaten bleiben weiterhin ausdrücklich getrennt und gehören zum Rohling.

## Nicht Bestandteil von 001T

- neue CAM-Bearbeitungsstrategien
- automatische Einschränkung von Operationen anhand des Fräsertyps
- V-Carve-Toolpath
- 3D-Schlichten mit Vollradiusfräser
- Planfräs-Operation
- werkzeugtypspezifische Materialtabellen
- Bohrertypologie

Diese Punkte bauen später auf dem 001T-Typmodell auf.

## Gates

### T1 — Typauswahl

Unter `Werkzeuge → Werkzeugdaten` nacheinander alle vier Typen wählen.

Erwartung: Die Auswahl ist eindeutig sichtbar und die Erklärung wechselt mit dem Fräsertyp.

### T2 — Adaptive Felder

- Schaftfräser: Schneidenlänge + Schaft-Ø sichtbar.
- Vollradiusfräser: Schneidenlänge + Schaft-Ø + abgeleiteter Kugelradius sichtbar.
- Planfräser: max. Schnitttiefe sichtbar; keine V-Fräser-Felder.
- V-Fräser: Winkel + Spitzen-Ø + Maximal-Ø sichtbar; keine Schaftfräser-Felder.

### T3 — Bibliothek

Von jedem Typ mindestens ein Werkzeug speichern, Werkzeugseite wechseln und wieder laden.

Erwartung: Typ und typabhängige technische Daten bleiben erhalten.

### T4 — Migration

Falls eine bestehende 001S-Bibliothek vorhanden ist, muss sie ohne Fehler geladen werden. Alte Werkzeuge erscheinen als Schaftfräser und behalten Name, Durchmesser, Schneidenzahl und fz.

### T5 — Schnittdaten

Bei gleichem Material müssen die vorhandenen Drehzahl-/Vorschubberechnung und Maschinenlimits weiterhin funktionieren. Der Materialkontext aus 001S bleibt erhalten.

### T6 — Explizite Übernahme

`Werkzeug & Schnittdaten übernehmen` ausführen und anschließend `Bearbeiten` prüfen. Name, Rechen-Ø, Drehzahl und Vorschub müssen weiterhin korrekt ankommen. Ein bloßer Typwechsel darf die aktive Operation nicht automatisch verändern.

### T7 — Regression

```bash
pnpm check
pnpm test
pnpm build
```

Danach:

```bash
pnpm tauri dev
```

Zusätzlich prüfen:

- Bauteil öffnen funktioniert weiterhin.
- Rohling-/Materialauswahl funktioniert weiterhin.
- Floh bleibt persistent.
- Bohren, Kontur, Tasche und Carven lassen sich weiterhin auswählen.
