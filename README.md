# BeBlog CAM

**CAM ohne Irrgarten.**

[English version](README.en.md)

BeBlog CAM ist eine quelloffene, makerfreundliche CAM-Anwendung für macOS. Sie macht aus DXF- und STEP-Geometrie sichtbare, prüfbare Werkzeugwege, ohne den Anwender durch Objektbäume, permanente Werkzeugleisten und tief verschachtelte Dialoge zu schicken.

**Aktueller Softwarestand: 0.2.0-beta.3 — Beta / Production Qualification.**

> **Klarheit ist nicht weniger Information. Klarheit ist Information zur richtigen Zeit.**

Der Arbeitsablauf bleibt bewusst stabil:

**Bauteil → Rohling → Werkzeuge → Bearbeiten → Prüfen → Fräsen**

## Was BeBlog CAM heute kann

BeBlog CAM deckt inzwischen einen breiten praktischen 3-Achs-Maker-CAM-Umfang ab.

### 2D / 2½D

- DXF-Import für planare Geometrie
- Planen
- Konturfräsen außen, innen und auf Linie
- geschlossene und bewusst geöffnete Konturen
- Durchfräsen mit Overcut und Haltestegen
- radiales/axiales Aufmaß und separate Schlichtdurchgänge
- Taschen mit Raster-, Kreis- und konturparallelen Strategien
- Rampen- und Helix-Eintauchen
- stock-aware/adaptives Taschenschruppen mit begrenztem radialem Eingriff
- Restmaterialbearbeitung mit kleinerem Folgewerkzeug
- Bohren und helikales Ausfräsen von Bohrungen
- Carve-Operationen

### Konturgeführtes Wirbelfräsen

Wirbelfräsen ist eine eigenständige Produktionsstrategie in BeBlog CAM und nicht nur ein Darstellungsmodus für eine normale Kontur.

Die aktuelle Implementierung unterstützt:

- genau ausgewählte geschlossene DXF-Konturen
- Innen- und Außenbearbeitung
- Gleich- und Gegenlauf mit physikalisch aufgelöster Werkzeugwegrichtung
- Trochoidenradius und Vorwärtsschritt
- mehrere Tiefenstufen
- manuelle Endtiefe oder stock-bottom Durchfräsen
- kontrollierten Overcut in eine definierte Opferplatte
- radiales und axiales Aufmaß
- scharfe rechteckige Außenkonturen mit tangential gerundeter Führungsbahn
- lokale Anpassung des Fortschritts an gekrümmte Bahnabschnitte
- automatische Begrenzung des Fortschritts anhand des zulässigen Materialeingriffs
- geschützten Helix-Einstieg
- konstruktiven Seed-Kreis und materialbewussten Bootstrap
- kanonische Vorschau, Simulation, Preflight und NC-Ausgabe aus derselben Werkzeugweg-Wahrheit

Ein zentraler Unterschied zu rein geometrischer Pfaderzeugung ist der Materialnachweis: Der Generator verwendet bereits nachweislich geräumtes Material als Voraussetzung für folgende Bootstrap- und Wirbelfräsbewegungen. Die aktuelle Sicherheitsgrenze für die freigegebene Materialumschlingung liegt bei 140°. Kann ein Schritt nicht innerhalb der bewiesenen Grenzen erzeugt werden, schlägt die Strategie fail-closed fehl, statt eine nur plausibel aussehende Bahn freizugeben.

### STEP / BRep und 3D

- nativer STEP/BRep-Import über Open CASCADE Technology (OCCT)
- vollständige Modellorientierung vor der CAM-Berechnung
- Rohlingplatzierung und Work-Coordinate-System
- STEP-Kontur-, Taschen- und Bohrworkflows
- Z-Level-Schruppen auf ausgewählten Zielflächen oder am Gesamtmodell
- BRep-Solid als Geometrieautorität beim Gesamtmodell-Schruppen
- Behandlung von Inseln, Erreichbarkeit und Materialzusammenhang
- 3D-Schruppen auf ausgewählten planaren und gekrümmten BRep-Flächen
- parallele X/Y-Schruppstrategien mit Schlichtaufmaß
- 3D-Schlichten direkt auf ausgewählten BRep-Flächen
- Vollradiusfräser für das freigegebene 3D-Schlichten
- fail-closed Freigabe der 3D-Werkzeugwege

Exakte STEP/BRep-Geometrie bleibt die Quelle der Wahrheit. Tessellation dient Darstellung und Interaktion; sie ersetzt nicht das CAD-Modell.

## Werkzeugbibliothek und Schnittdaten

Die Werkzeugverwaltung ist nicht mehr nur Teil einzelner Operationen. BeBlog CAM besitzt eine eigenständige Werkzeugbibliothek mit JSON-Import und -Export sowie erweiterten Werkzeugtypen. Werkzeuge können Operationen zugeordnet und mit den für die Sicherheits- und Erreichbarkeitsprüfung relevanten Geometriedaten beschrieben werden.

Schnittdaten bleiben bewusst sichtbar und nachvollziehbar: Vorschub, Eintauchvorschub, Drehzahl, Zustellung, seitliche Zustellung und Sicherheits-Z werden nicht hinter einer undurchsichtigen Automatik versteckt.

## Prüfen ist ein Produktions-Gate

Eine CAM-Anwendung sollte nicht verlangen, einer Berechnung zu vertrauen, die man nicht sehen kann.

BeBlog CAM verwendet deshalb eine kanonische Maschinenbewegungskette. Preview, Simulation, Inspector, Preflight und NC sollen keine getrennten Interpretationen desselben Jobs sein.

> **Inspector Motion Truth = Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth.**

Der Produktionspfad lautet:

**Operation → Canonical Toolpath → Safe Motion → Preview / Simulation → Prüfen → NC**

Der Job-Preflight kann unter anderem Werkzeugwegvalidierung, Reststock, Werkzeug-/Haltergeometrie, Fixtures, Maschinenraumgrenzen und Spindelkopf-Kollisionen prüfen. Unsichere oder nicht beweisbare Zustände werden nicht stillschweigend in NC umgewandelt.

**Kein Überraschungsei an der Maschine.**

## Koordinatenmodell

> **Part lives in stock. Stock lives on the machine.**

BeBlog CAM trennt:

- **Part** — Konstruktionsgeometrie und CAM-Ziele
- **Stock** — das reale Rohmaterial
- **WCS** — das an der CNC gemessene Werkstückkoordinatensystem

Daraus folgt:

**Part → Stock → WCS → Machine**

Antasten und Werkzeuglängenverwaltung bleiben Aufgaben der Maschinensteuerung und werden nicht als verstecktes CAM-Verhalten simuliert.

## Product DNA

BeBlog CAM wird aus Sicht eines Hobby-Makers entwickelt, nicht aus Sicht einer industriellen CAM-Abteilung.

- Die linke Seite bleibt einfach; Komplexität wächst kontextbezogen rechts.
- Das Werkstück bleibt das visuelle Zentrum.
- Funktionen erscheinen dort, wo sie im Bearbeitungsablauf gebraucht werden.
- Technische Tiefe darf nicht automatisch visuelle Komplexität erzeugen.
- Expertenparameter bleiben erreichbar, ohne Standardanwender mit ihnen zu überladen.
- Kernel-Begriffe wie BRep oder Tessellation bleiben intern, solange sie nicht bei einer Diagnose helfen.
- **Prüfen** ist ein echter Arbeitsschritt vor der Maschinenausgabe.
- Bedienbarkeit wird nicht auf eine spätere Politur verschoben.

> **BeBlog CAM zeigt einen Arbeitsablauf, keine Werkzeugkiste.**

Der vollständige Produktvertrag steht in [docs/PRODUCT-DNA.md](docs/PRODUCT-DNA.md).

## Technische Basis

- **Desktop:** Tauri v2
- **Frontend:** Svelte 5 + TypeScript
- **Native Anwendung/Core:** Rust
- **Exakte CAD-Geometrie:** Open CASCADE Technology (OCCT)
- **Primäre Plattform:** macOS
- **Aktueller Binärpfad:** Apple Silicon (arm64)
- **Paketmanager:** pnpm
- **NC/Postprocessing:** Estlcam-, GRBL- und LinuxCNC-Dialekte

Geometrie, CAM-Strategien, Visualisierung, Validierung und Postprocessing sind so getrennt, dass eine Schicht weiterentwickelt werden kann, ohne stillschweigend die Bedeutung einer anderen umzudefinieren.

## Entwicklung

Frontend/static gates:

```bash
pnpm check
pnpm build
```

Native macOS-Entwicklungsanwendung:

```bash
pnpm native:dev
```

Für STEP/BRep- und 3D-Workflows ist der native Pfad erforderlich.

### Native Production Build

```bash
pnpm native:build
```

Dieser Build aktiviert `occt-native`, ermittelt die benötigte OCCT-Runtime-Dependency-Closure, bündelt sie in der Anwendung und prüft, dass das Ergebnis die bundle-lokalen Frameworks statt einer lokalen Entwicklerinstallation verwendet.

Ein einfaches `pnpm tauri build` gilt deshalb **nicht als gültiger Production Build** für den nativen STEP/BRep-Funktionsumfang.

## Release und Installation

Der Quell- und Entwicklungsstand ist **0.2.0-beta.3**.

Veröffentlichte Binärartefakte sollten separat anhand des jeweiligen Releases, Dateinamens und SHA-256-Werts verifiziert werden. Diese README übernimmt bewusst keinen Prüfsummenwert eines älteren Beta-Artefakts für einen neueren Softwarestand.

Die macOS-Beta verwendet derzeit keine Apple-Developer-ID-Signatur/Notarisierung. Gatekeeper kann deshalb beim ersten Start eine manuelle Freigabe über **Systemeinstellungen → Datenschutz & Sicherheit → Dennoch öffnen** verlangen. Eine globale Deaktivierung von Gatekeeper ist nicht erforderlich.

BeBlog CAM ist Beta-Software. Werkzeugwege und NC müssen vor realer Bearbeitung geprüft werden; die üblichen maschinenseitigen Sicherheitsmaßnahmen bleiben erforderlich.

## Aktueller Entwicklungsstand

Build 008 etablierte die Production-Readiness-Basis einschließlich Acceptance-Suite, Projekt-/Fehlerhärtung, STEP-Modellorientierung, Z-Level-Performance und nativer macOS-Verpackung.

Build 009 baute die Werkzeugbibliothek mit Import/Export und erweitertem Werkzeugmodell aus.

Build 010 etablierte das konturgeführte Wirbelfräsen als vollständige CAM-Strategie: von semantischer Führungsgeometrie und Materialnachweis über geschützten Einstieg, Multi-Depth und reale Bearbeitungsgrenzen bis zur kanonischen Vorschau und NC-Ausgabe.

**Status: Beta / Production Qualification — 0.2.0-beta.3.**

Features gelten erst dann als etabliert, wenn technische Gates und reale Acceptance zusammenpassen.

Und ja: Es gibt einen CAM-Floh. Seine Aufgabe ist es, Probleme zu finden, bevor die Fräse es tut. 🐜
