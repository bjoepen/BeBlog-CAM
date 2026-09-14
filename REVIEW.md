# BeBlog CAM — Review Findings

## 008-RW-003 — Pocket depth-level retract overuse

- **ID:** 008-RW-003
- **Kategorie:** Toolpath / Safe Motion / Manufacturing Efficiency
- **Severity / Priorität:** Medium / P1 für Production Readiness
- **Confidence:** Very High
- **Status:** Implemented / Pending local QA
- **Betroffene Dateien / Codebereiche:**
  - `src/lib/pocketStayDown.ts`
  - `src/lib/pocketCanonicalToolpath.ts`
  - `src/lib/regionPocketToolpath.ts`
  - `src/lib/safeMotionChain.ts`
  - Pocket Canonical Toolpath → Safe Motion → Preview / Preflight → NC

### Beobachtung

Im Real-World-Test zeigte die Manufacturing Preview bei Taschenbearbeitungen weiterhin eine auffällig hohe Zahl von Retracts zwischen aufeinanderfolgenden Tiefenstufen. Der erste Fix reduzierte den Real-World-Export nur geringfügig und löste die Ursache nicht vollständig.

Die anschließende read-only Nachanalyse ergab drei gekoppelte Ursachen:

1. Der Gesamtjob wird aus den von Preflight/004T materialisierten `toolpath.motions` exportiert und nicht direkt aus dem zuvor geänderten Pocket-G-Code-Generator.
2. Explizit gewählte DXF-Taschenstrategien laufen über `buildDxfRegionPocket()` / `buildRegionPocketToolpath()` und setzten bisher jeden Run auf `retractAfter:true`.
3. `materializeSafeMotionChain()` ignorierte die bereits vorhandene kanonische Semantik `retractAfter:false` und erzeugte nach jedem Run zwingend einen globalen Safe-Z-Retract.

### Begründung / Risiko

Das bisherige Verhalten war geometrisch konservativ und damit grundsätzlich sicher, erzeugte aber unnötige Z-Bewegungen, zusätzliche Plunges und längere Bearbeitungszeiten. Bei realen Taschenjobs wurde das in der Preview als wiederkehrendes Retract-Muster deutlich sichtbar.

Eine pauschale Entfernung von Retracts ist ausdrücklich nicht zulässig. Die Production-Invariante bleibt bindend:

`Inspector Motion Truth = Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth`

### Implementierter Contract

1. `retractAfter !== false` behält unverändert das historische fail-closed Verhalten: globaler Safe-Z-Retract vor dem nächsten Run.
2. `retractAfter === false` gilt als explizite kanonische Zertifizierung, dass der direkte Connector zum nächsten kanonischen Entry/Start im bereits freigeräumten Raum liegt.
3. 004T materialisiert einen solchen Connector auf aktueller Schnitttiefe und fährt anschließend über den kanonischen Entry bzw. die nächste Zustellung weiter, ohne globales Safe-Z zu besuchen.
4. Ist der Contract unvollständig oder inkonsistent — z. B. kein Folgerun, falscher Entry-Z-Anker oder nicht zusammenhängende Bewegung — schlägt 004T fail-closed fehl.
5. `buildRegionPocketToolpath()` setzt `retractAfter:false` nur bei Übergängen auf eine tiefere Zustellung, deren direkter Connector mit derselben Region-/Insel-Topologie geometrisch geprüft wurde.
6. Inseln, getrennte Regionen oder nicht beweisbare Connectoren behalten den globalen Safe-Z-Retract.
7. Die Optimierung bleibt vor dem Postprozessor in der kanonischen Motion Truth; Estlcam- oder andere Postprozessoren rekonstruieren keine Geometrie.

### Regression / Acceptance

Der frühere RW-003-Gate prüfte überwiegend statische Quelltextmerkmale und konnte deshalb einen falschen PASS liefern. Er wurde durch einen ausführbaren Production-Path-Gate ersetzt:

`Operation → Canonical Toolpath → 004T Safe Motion → Gesamtjob-NC`

Der Gate prüft mindestens:

- AUTO-Tasche mit mehreren Zustellungen,
- explizit konturparallele DXF-Tasche,
- keine globalen Safe-Z-Retracts zwischen zertifizierten Tiefenstufen,
- globales Safe-Z am Operationsende,
- fail-closed Retracts bei unabhängigen Runs,
- reduzierte Rapid-Anzahl bei zertifiziertem Stay-down,
- Fehler bei offenem/ungültigem `retractAfter:false`-Contract.

### Abgrenzung

Das Finding bedeutet **nicht**, dass BeBlog CAM keine Pocket-Stay-down-Optimierung besitzt. Die vorhandene Optimierung innerhalb einer Ebene bleibt bestehen. RW-003 erweitert die kanonische Semantik auf nachweislich sichere Übergänge zwischen aufeinanderfolgenden Tiefenebenen.

### Freigabe / aktueller Stand

Finding und Zielbild wurden im Real-World-Review am 2026-09-13 bestätigt. Nach erneutem Real-World-Nachweis der verbleibenden Retracts wurde die Architektur am 2026-09-14 read-only auditiert und die korrigierte Lösung ausdrücklich zur Umsetzung freigegeben.

Implementierung ist vorhanden; Status bleibt **Pending local QA**, bis `check:008rw3`, Type-/Svelte-Check, Build und der erneute Rod-Plate-Real-World-Export PASS sind.

---

## 008-RW-004 — Contour Entry Safe Anchor wrong

- **ID:** 008-RW-004
- **Kategorie:** Safe Motion / Contour Entry / Preview-NC Parity
- **Severity / Priorität:** Medium / P1 für Production Readiness
- **Confidence:** Very High
- **Status:** Implemented / Pending local QA
- **Betroffene Dateien / Codebereiche:**
  - `src/lib/safeMotionChain.ts`
  - `src/lib/contourLeads.ts`
  - Canonical Contour Toolpath → 004T Safe Motion → Preview / Preflight → NC

### Beobachtung

Im Rod-Plate-Real-World-Export wurde eine geschlossene Kontur mit aktivem Lead-in zunächst auf Safe-Z am eigentlichen Konturstart angefahren, danach auf Safe-Z zum 3-mm-Lead-Start zurückgefahren und erst dort eingetaucht. Die Schnittgeometrie selbst war plausibel; die Safe-Z-Anfahrt besuchte jedoch einen unnötigen Zwischenpunkt.

### Ursache

`applyContourLeads()` beschreibt den expliziten Entry korrekt als:

`Lead-Start @ Safe-Z → Lead-Start @ Schnitttiefe → Konturstart @ Schnitttiefe`

004T leitete `safeStart` bislang trotzdem aus `run.points[0]` ab. Bei Runs mit expliziten `entrySegments` ist aber deren erster XY-Punkt der kanonische Anfahranker.

### Implementierter Contract

1. Ohne expliziten Entry bleibt `run.points[0]` der Safe-Z-Anfahranker.
2. Mit `entrySegments` verwendet 004T die XY-Koordinate von `entrySegments[0].start` als Safe-Z-Anfahranker.
3. Falls der Entry selbst unter Safe-Z beginnt, positioniert 004T zuerst auf derselben XY-Koordinate bei Safe-Z und materialisiert anschließend den expliziten Entry; es erfindet keinen alternativen Werkzeugweg.
4. Der Konturstart wird vor dem Lead-in nicht mehr unnötig auf Safe-Z besucht.
5. Preview, Preflight und NC erhalten weiterhin dieselbe materialisierte Motion Truth.

### Regression / Acceptance

`scripts/check-008rw4-contour-entry.mjs` kompiliert eine ausführbare Acceptance-Fixture mit explizitem Lead-in und prüft den Ablauf vor dem Entry. Der spätere legitime Retract einer geschlossenen Kontur auf denselben XY-Punkt wird ausdrücklich nicht als Entry-Fehler gewertet.

### Freigabe / aktueller Stand

Korrektur wurde am 2026-09-14 ausdrücklich freigegeben und implementiert. Status bleibt **Pending local QA**, bis `check:008rw4`, 004T-Gates, Type-/Svelte-Check, Build und erneuter Rod-Plate-Export PASS sind.

---

## 008-RW-006 — Contour Start & Entry Placement

- **ID:** 008-RW-006
- **Kategorie:** CAM Planning / Contour Entry / UX
- **Severity / Priorität:** P1 vor RC
- **Confidence:** High
- **Status:** Core implemented / Pending local QA and UI wiring
- **Betroffene Dateien / Codebereiche:**
  - `src/lib/types.ts`
  - `src/lib/contourStartPlacement.ts`
  - `src/lib/contourEntry.ts`
  - `src/lib/gcode.ts`
  - Canonical Contour Toolpath → 004T → Preview / Preflight / NC

### Beobachtung

Der bisherige geschlossene Konturpfad übernahm seinen Start implizit aus der Reihenfolge der importierten DXF-/Toolpath-Geometrie. Für reale Außenkonturen kann dieser Punkt nahe einer Ecke oder an einer fertigungstechnisch ungünstigen Stelle liegen. Bei Rampeneinfahrt wird die Startwahl zusätzlich sicherheits- und qualitätsrelevant, da ab dem Start genügend zusammenhängende Konturstrecke für den Z-Abstieg benötigt wird.

### Freigegebener Contract

1. `startMode: auto | manual` ist Bestandteil der ContourOperation.
2. Der manuelle Start wird als normalisierte Position `startFraction` entlang der geschlossenen Kontur gespeichert; keine rohe, fragile XY-Referenz.
3. Auto bevorzugt die Mitte einer langen Geraden und verwendet nur dann ein anderes längstes Segment, wenn keine geeignete Gerade vorhanden ist.
4. Alle Z-Ebenen einer Operation werden zyklisch am selben Start neu angeordnet.
5. Start Placement geschieht vor Entry/Lead/Rampe und Tabs, sodass alle nachfolgenden Stufen denselben Start verwenden.
6. `entryMode: plunge | lead | ramp` trennt Startpunkt und Einfahrstrategie fachlich. Alte Projekte ohne `entryMode` bleiben kompatibel: `leadMode=line` wird als `lead`, sonst als `plunge` interpretiert.
7. Geschlossene Rampeneinfahrt verwendet `rampAngleDeg`; die benötigte Rampenlänge ergibt sich aus der aktuellen Zustellung und dem Winkel.
8. Die Rampe folgt der kanonischen Kontur, erreicht die neue Z-Ebene und bereinigt den Rampenabschnitt auf Soll-Z zurück bis zum gemeinsamen Konturstart, bevor der vollständige Konturschnitt beginnt.
9. Reicht die Konturlänge nicht aus oder ist der Rampencontract inkonsistent, wird die Operation fail-closed abgewiesen. Kein stiller Plunge-Fallback.
10. Aufgebrochene/offene Konturen behalten ihre vorhandenen spezialisierten Entry-Regeln und werden nicht stillschweigend in RW-006 einbezogen.

### Acceptance

`check:008rw6` prüft ausführbar:

- Auto-Start auf der Mitte einer bevorzugten langen Geraden,
- deterministischen manuellen Start über mehrere Tiefenebenen,
- kanonische Rampeneinfahrt mit Rückkehr zum Konturstart auf Ziel-Z,
- Akzeptanz der Entry-Kette durch 004T,
- fail-closed bei unzureichender Rampenlänge.

### Noch offen

Der Core-Contract ist implementiert. Die direkte Auswahl des manuellen Startpunkts in der Bearbeiten-Preview sowie die endgültigen Inspector-Bedienelemente werden erst nach grünem lokalen Core-Gate verdrahtet, damit ein eventueller Geometrie-/Type-Fehler nicht mit UI-Arbeit vermischt wird.
