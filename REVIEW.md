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
