# BeBlog CAM — Review Findings

## 008-RW-003 — Pocket depth-level retract overuse

- **ID:** 008-RW-003
- **Kategorie:** Toolpath / Safe Motion / Manufacturing Efficiency
- **Severity / Priorität:** Medium / P1 für Production Readiness
- **Confidence:** High
- **Status:** Accepted
- **Betroffene Dateien / Codebereiche:**
  - `src/lib/pocketStayDown.ts`
  - `src/lib/pocketCanonicalToolpath.ts`
  - Pocket Canonical Toolpath → Safe Motion → Preview / Preflight → NC

### Beobachtung

Im Real-World-Test zeigt die Manufacturing Preview bei Taschenbearbeitungen weiterhin eine auffällig hohe Zahl von Retracts zwischen aufeinanderfolgenden Tiefenstufen.

Die bestehende Stay-down-Optimierung ist vorhanden und wird im Canonical-Pocket-Pfad verwendet. Sie reduziert jedoch primär sichere Verbindungen zwischen Offsets innerhalb einer Taschenebene. Übergänge zwischen aufeinanderfolgenden Tiefenebenen werden weiterhin häufig als getrennte Runs mit Safe-Z-Retract behandelt.

### Begründung / Risiko

Das Verhalten ist geometrisch konservativ und damit grundsätzlich sicher, erzeugt aber unnötige Z-Bewegungen, zusätzliche Plunges und längere Bearbeitungszeiten. Bei realen Taschenjobs wird das in der Preview als wiederkehrendes Retract-Muster deutlich sichtbar.

Eine pauschale Entfernung von Retracts ist ausdrücklich nicht zulässig. Die Production-Invariante bleibt bindend:

`Inspector Motion Truth = Simulation Motion Truth = Preview Motion Truth = Preflight Motion Truth = NC Motion Truth`

### Empfehlung

Die bestehende Stay-down-Strategie um einen fail-closed Depth-Level-Linking-Contract erweitern:

1. Bestehendes `pocketStayDown` innerhalb einer Tiefenebene unverändert weiterverwenden.
2. Nach Abschluss einer Tiefenebene prüfen, ob der Einstiegspunkt der nächsten Ebene über nachweislich bereits freigeräumten Raum erreichbar ist.
3. Nur bei geometrisch bewiesen sicherem Connector den vollständigen Safe-Z-Retract vermeiden bzw. eine zulässige lokale Clearance verwenden.
4. Bei Inseln, getrennten Regionen, unbekannter Topologie oder sonstiger Ambiguität den bestehenden Safe-Z-Retract beibehalten.
5. Die Optimierung muss auf dem Canonical Toolpath stattfinden bzw. dort vollständig repräsentiert sein, damit Preview, Preflight und NC dieselbe Bewegung sehen.
6. Regression-Gates müssen mindestens einfache Taschen, Inseln/Öffnungen, getrennte Regionen und einen Fall mit zwingend erforderlichem Retract abdecken.

### Abgrenzung

Das Finding bedeutet **nicht**, dass BeBlog CAM keine Pocket-Stay-down-Optimierung besitzt. Das Problem ist enger gefasst: Die vorhandene Optimierung nutzt bereits freigeräumtes Material zwischen aufeinanderfolgenden Tiefenebenen noch nicht ausreichend.

### Freigabe

Finding und Zielbild wurden im Real-World-Review am 2026-09-13 gemeinsam bestätigt und zur späteren Umsetzung freigegeben. Die konkrete Implementierung erfolgt erst im dafür festgelegten Fix-/Hardening-Schritt.
