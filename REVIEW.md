# BeBlog CAM — Review Findings

## 008-RW-003 — Pocket depth-level retract overuse

- **ID:** 008-RW-003
- **Kategorie:** Toolpath / Safe Motion / Manufacturing Efficiency
- **Severity / Priorität:** Medium / P1 für Production Readiness
- **Confidence:** Very High
- **Status:** PASS / Real-World accepted
- **Betroffene Dateien / Codebereiche:**
  - `src/lib/pocketStayDown.ts`
  - `src/lib/pocketCanonicalToolpath.ts`
  - `src/lib/regionPocketToolpath.ts`
  - `src/lib/safeMotionChain.ts`
  - Pocket Canonical Toolpath → Safe Motion → Preview / Preflight → NC

### Beobachtung

Im Real-World-Test zeigte die Manufacturing Preview bei Taschenbearbeitungen eine auffällig hohe Zahl von Retracts zwischen aufeinanderfolgenden Tiefenstufen. Die Nachanalyse identifizierte den Production-Path über kanonischen Toolpath, 004T und Gesamtjob-NC als maßgeblich.

### Implementierter Contract

1. `retractAfter !== false` behält das fail-closed Verhalten mit globalem Safe-Z-Retract.
2. `retractAfter === false` gilt nur als explizite kanonische Zertifizierung eines geometrisch geprüften Stay-down-Übergangs.
3. 004T materialisiert zertifizierte Übergänge auf aktueller Schnitttiefe und erfindet keine Postprozessor-Geometrie.
4. Unvollständige oder inkonsistente Stay-down-Contracts schlagen fail-closed fehl.
5. Inseln, getrennte Regionen und nicht beweisbare Connectoren behalten Safe-Z.
6. Preview, Preflight und NC konsumieren dieselbe kanonische Motion Truth.

### Regression / Acceptance

`check:008rw3` prüft den ausführbaren Production Path einschließlich mehrerer Zustellungen, expliziter DXF-Taschenstrategie, zertifiziertem Stay-down, fail-closed Retracts und Gesamtjob-NC.

Die lokale Rod-Plate-Real-World-QA und der daraus erzeugte vollständige Gesamtjob sind PASS. Die beobachtete Retract-Problematik wurde im realen Produktionspfad erneut geprüft und abgenommen.

### Freigabe / aktueller Stand

Finding und Zielbild wurden im Real-World-Review bestätigt, implementiert und anschließend im Rod-Plate-Real-World-Job abgenommen. **RW-003 ist abgeschlossen und PASS.**

---

## 008-RW-004 — Contour Entry Safe Anchor wrong

- **ID:** 008-RW-004
- **Kategorie:** Safe Motion / Contour Entry / Preview-NC Parity
- **Severity / Priorität:** Medium / P1 für Production Readiness
- **Confidence:** Very High
- **Status:** PASS / Real-World accepted
- **Betroffene Dateien / Codebereiche:**
  - `src/lib/safeMotionChain.ts`
  - `src/lib/contourLeads.ts`
  - Canonical Contour Toolpath → 004T Safe Motion → Preview / Preflight → NC

### Beobachtung

Im Rod-Plate-Real-World-Export wurde eine geschlossene Kontur mit Lead-in zunächst unnötig am eigentlichen Konturstart auf Safe-Z angefahren. Der kanonische Entry-Anker musste stattdessen aus dem expliziten Entry stammen.

### Implementierter Contract

1. Ohne expliziten Entry bleibt `run.points[0]` der Safe-Z-Anfahranker.
2. Mit `entrySegments` verwendet 004T `entrySegments[0].start` als kanonischen Safe-Z-Anfahranker.
3. Beginnt der Entry unter Safe-Z, positioniert 004T zuerst auf derselben XY-Koordinate bei Safe-Z und materialisiert danach ausschließlich den expliziten Entry.
4. Der Konturstart wird vor dem Lead-in nicht mehr unnötig auf Safe-Z besucht.
5. Preview, Preflight und NC erhalten dieselbe materialisierte Motion Truth.

### Regression / Acceptance

`check:008rw4` prüft die ausführbare Acceptance-Fixture mit explizitem Lead-in und den korrekten Ablauf vor dem Entry.

Die lokale Rod-Plate-Real-World-QA und der vollständige Gesamtjob sind PASS; die Safe-Z-Anfahrt wurde im realen Produktionspfad abgenommen.

### Freigabe / aktueller Stand

Korrektur wurde freigegeben, implementiert und im Rod-Plate-Real-World-Job abgenommen. **RW-004 ist abgeschlossen und PASS.**

---

## 008-RW-006 — Contour Start & Entry Placement

- **ID:** 008-RW-006
- **Kategorie:** CAM Planning / Contour Entry / UX
- **Severity / Priorität:** P1 vor RC
- **Confidence:** High
- **Status:** PASS / Real-World accepted
- **Betroffene Dateien / Codebereiche:**
  - `src/lib/types.ts`
  - `src/lib/contourStartPlacement.ts`
  - `src/lib/contourEntry.ts`
  - `src/lib/gcode.ts`
  - `src/lib/ContourOverlay.svelte`
  - `scripts/check-008rw6-contour-start-entry.mjs`
  - `scripts/check-008rw6-ui.mjs`
  - Canonical Contour Toolpath → 004T → Preview / Preflight / NC

### Freigegebener und implementierter Contract

1. `startMode: auto | manual` und normalisierte `startFraction` bilden den geschlossenen Konturstart deterministisch ab.
2. Auto bevorzugt die Mitte einer langen Geraden; alle Z-Ebenen verwenden denselben zyklisch angeordneten Start.
3. Start Placement geschieht vor Entry und Tabs.
4. `entryMode: plunge | lead | ramp` trennt Startpunkt und Einfahrstrategie.
5. Rampeneinfahrt folgt der kanonischen Kontur und schlägt bei unzureichender Konturlänge fail-closed fehl.
6. Offene Konturen behalten ihre spezialisierten Entry-Regeln.

### UI / Acceptance

Der DXF-Real-World-Pfad bietet Auto/Manual, Preview-Picking, sichtbaren Startmarker, Senkrecht/Tangential/Rampe und ein verschiebbares Konturstart-Panel. Panel-Dragging bleibt reine Viewport-UX ohne CAM-/Motion-State.

`check:008rw6` und `check:008rw6-ui` sind PASS. Die lokale Rod-Plate-UI-QA, der vollständige Gesamtjob und das verschiebbare Panel wurden im Native UI abgenommen. **RW-006 ist abgeschlossen und PASS.**

### Abgrenzung

Die direkte manuelle Startauswahl im nativen STEP-3D-Viewport bleibt ein separater späterer UI-Anschluss und blockiert 008 nicht.

---

## 008 — Production Readiness Abschlussstand

- **Repository-/CI-Status:** PASS
- **Rod-Plate Real-World Job:** PASS
- **RW-003:** PASS / Real-World accepted
- **RW-004:** PASS / Real-World accepted
- **RW-006:** PASS / Real-World accepted
- **004Y / 004Z / 008B4 Regression-Harness:** an aktuellen Contract angepasst; CI PASS

Die während des Post-PASS-Audits gefundenen historischen Gate-Abweichungen in 004Y, 004Z und 008B4 wurden ausschließlich auf Regression-/Acceptance-Seite korrigiert. Sie erforderten keine nachträgliche Aufweichung des CAM-Kernels oder der kanonischen Motion Truth.

### 008C — Estlcam Qualification

**008C1 — Qualification Baseline: PASS.**

Das qualifizierte Referenzprofil bleibt Estlcam 11 Build 11245, 3-axis milling, millimetres, manual tool change. Der Postprozessor ist syntax-only und darf keine Geometrie oder Motion Truth rekonstruieren.

**008C2 — Reference NC Artifact: PASS / frozen.**

Eine deterministische Referenz-NC wurde für die spätere externe Abnahme eingefroren. Der Freeze/Manifest-Contract schützt Byte-Identität, SHA-256, Werkzeugwechsel-Erwartung und terminales `M5`.

**008C3 — Manual Estlcam 11 Acceptance: DEFERRED / MANUAL.**

Der Test der eingefrorenen Referenz-NC unter dem realen Estlcam 11 Build 11245 erfolgt bewusst später auf Windows. Dieser externe Abnahmeschritt ist kein GitHub-CI-Gate und wird bis zur tatsächlichen Durchführung nicht als PASS markiert.

Zu prüfen sind insbesondere Dateiakzeptanz, Werkzeugwechsel, Bahn-/Operationsreihenfolge sowie Start-/Endverhalten.

**008C4 — Real-machine Qualification: DEFERRED / MANUAL.**

Ein kontrollierter Maschinen-Dry-Run und eine gegebenenfalls anschließende reale Materialbearbeitung bleiben ein separater lokaler Produktionsqualifikationsschritt. Auch dieser Schritt wird nicht synthetisch durch CI ersetzt.

### Merge-Interpretation

Die bewusst verschobenen externen 008C3/008C4-Abnahmen stellen keine offene Software-Implementierung dar. Der 008-Softwarestand kann nach finalem read-only Branch-/Merge-Audit abgeschlossen und gemergt werden. Die spätere Estlcam-/Maschinenqualifikation wird gegen das eingefrorene Referenzartefakt durchgeführt und separat dokumentiert.
