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

`scripts/check-008rw4-contour-entry.mjs` kompiliert eine ausführbare Acceptance-Fixture mit explizitem Lead-in und prüft:

- erster materialisierter Safe-Z-Anker = Lead-Start,
- erster Safe-Z-Anker ist nicht der Konturstart,
- kein Rapid besucht den Konturstart auf Safe-Z vor dem Lead-in,
- 004T akzeptiert die zusammenhängende Entry-Kette.

### Freigabe / aktueller Stand

Korrektur wurde am 2026-09-14 ausdrücklich freigegeben und implementiert. Status bleibt **Pending local QA**, bis `check:008rw4`, 004T-Gates, Type-/Svelte-Check, Build und erneuter Rod-Plate-Export PASS sind.

---

## 008-RW-006 — User-selectable contour start point

- **ID:** 008-RW-006
- **Kategorie:** CAM UX / Contour Planning
- **Severity / Priorität:** Enhancement / nach RW-004 verifizieren
- **Confidence:** Medium
- **Status:** Proposed

### Beobachtung

Der automatisch gewählte Konturstart ist nicht immer fertigungstechnisch oder visuell optimal. Für reale Werkstücke kann es sinnvoll sein, den Startpunkt einer geschlossenen Kontur bewusst zu platzieren, z. B. mittig auf einer langen geraden Seite statt nahe einer Ecke.

### Zielbild

Für geschlossene Konturen soll optional ein Benutzer-Startpunkt wählbar sein. Die Auswahl muss auf die vorhandene Konturgeometrie projiziert und anschließend in der kanonischen Toolpath-Reihenfolge berücksichtigt werden, bevor Lead-in/Lead-out erzeugt werden.

### Anforderungen für eine spätere Umsetzung

1. `Auto` bleibt Standard und vollständig rückwärtskompatibel.
2. Benutzer kann einen Punkt bzw. eine Position auf der ausgewählten geschlossenen Kontur bestimmen.
3. Der Start darf nicht einfach die Geometrie verschieben; die Kontur muss zyklisch am gewählten Punkt aufgetrennt/rotiert werden.
4. Bei LINE-Segmenten muss ein Start mitten auf dem Segment möglich sein; bei ARC-Segmenten entsprechend auf dem Bogen.
5. Lead-in/-out wird erst **nach** Auflösung des Startpunkts erzeugt.
6. Tabs, Finish-Passes, Preview, Safe Motion und NC müssen denselben Startpunkt verwenden.
7. Ungültige oder nicht mehr auflösbare gespeicherte Startpunkte müssen fail-closed auf `Auto` zurückfallen oder explizit gewarnt werden; keine stille Geometrieänderung.

### Abgrenzung

Dieses Feature ist bewusst nicht Bestandteil des RW-004-Bugfixes. RW-004 korrigiert ausschließlich den falschen Safe-Z-Anfahranker eines bereits vorhandenen kanonischen Lead-ins.
