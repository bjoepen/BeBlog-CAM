# BeBlog CAM 001W — Circular Pocket Helical Clearing

## Ziel

001W erweitert die **bestehende Taschenbearbeitung** um einen Helix-Einstieg für native Kreistaschen. Es entsteht ausdrücklich **keine neue Bearbeitungsart** und keine zweite Helix-Welt.

Der Nutzer bleibt in:

**Bearbeiten → Tasche → Eintauchen → Helix**

Die Kreistasche wird nach dem Helix-Einstieg konzentrisch von innen nach außen geräumt. Die CAD-Kreisgeometrie bleibt das Fertigmaß; der äußerste Fräsermittelpunkt-Ring ist die radiuskorrigierte Fertigbahn.

## Architektur

- `PocketOperation` bleibt die fachliche Operation.
- `PocketEntry` erhält `helix` zusätzlich zu `plunge` und `ramp`.
- Helixbohrung und Kreistaschen-Helix verwenden dieselbe Low-Level-Primitive in `src/lib/helicalMotion.ts`.
- Es gibt keinen neuen `OperationKind`, keinen neuen linken Workflow-Schritt und keinen zusätzlichen Eintrag unter `+ Bearbeitung`.
- Die bestehende Postprozessor-Pipeline bleibt unverändert.

## Freigegebener 001W-Pfad

Helix ist in 001W bewusst eng begrenzt:

- native DXF-Kreistasche,
- Räumstrategie `Automatisch` (auflöst zu Kreis) oder `Kreis`,
- Schaftfräser aus der Werkzeugbibliothek,
- Werkzeug kleiner als die Kreistasche,
- positiver Fräsermittelbahnradius für die Helix,
- WCS-Z auf Rohlingoberseite.

Der Helixradius wird innerhalb des sicheren Fräsermittelpunktbereichs gewählt. Nach jeder Helix-Zustellung fährt das Werkzeug auf derselben Schnitttiefe zum Zentrum und räumt die vorhandenen konzentrischen Ringe bis zur Fertigwand.

## Nicht Bestandteil

- separate „Helix-Tasche“-Operation,
- Helix-Einstieg für Rechteck-, Polygon- oder konturparallele Taschen,
- adaptive oder trochoidale Räumstrategien,
- Inseln,
- Restmaterialbearbeitung,
- STEP-basierte Taschenerkennung,
- allgemeine Werkzeug–Operation-Kompatibilitätsmatrix.

## Gates

### W1 — Eine Taschenwelt

PASS wenn `OperationKind` unverändert bleibt und Helix ausschließlich als `PocketOperation.entry` auswählbar ist.

### W2 — Native Kreistasche

Mit einer nativen DXF-Kreistasche, einem passenden Schaftfräser und `Eintauchen = Helix` muss Preflight PASS erreichen.

### W3 — Geometrische Grenze

Helix auf einer nicht-kreisförmigen Tasche muss FAIL ergeben. Es darf kein G-Code erzeugt werden.

### W4 — Werkzeugtyp

Planfräser, Vollradiusfräser und V-Fräser müssen für den Helix-Einstieg FAIL ergeben. Freigegeben ist in 001W nur der Schaftfräser.

### W5 — Platz für die Helix

Wenn Werkzeug und Kreistasche keinen positiven Fräsermittelbahnradius zulassen, muss Preflight FAIL ergeben.

### W6 — Gemeinsame Helixprimitive

Helixbohrung und Kreistaschen-Helix müssen `buildHelicalDescent()` aus `src/lib/helicalMotion.ts` verwenden. Keine zweite, divergierende G3-Heliximplementierung.

### W7 — Maschinenpfad

Für eine gültige Kreistasche muss der erzeugte G-Code:

- auf Sicherheits-Z anfahren,
- am Helixstart auf Z0 zustellen,
- mit nativen G3-Halbkreisen und simultaner Z-Bewegung auf die Zielstufe fahren,
- danach auf Schnitttiefe zum Zentrum wechseln,
- konzentrisch von innen nach außen räumen,
- den äußersten Ring als Fertigumlauf fahren,
- keine G0-XY-Bewegung im Material ausführen.

### W8 — Regression

Unverändert PASS bleiben müssen:

- Kreistasche mit senkrechtem Eintauchen,
- Rechtecktasche mit Senkrecht/linearer Rampe,
- konturparallele Tasche,
- axiales Bohren,
- Helixbohren aus 001V,
- Planen, Kontur und Carve,
- Gesamtjob und bestehende Postprozessoren.

## Real-World-Test

Empfohlener Test:

1. DXF mit einer klar bekannten Kreistasche laden, z. B. Ø50 mm.
2. Schaftfräser Ø6 mm übernehmen.
3. `Tasche → Kreis/Automatisch → Eintauchen → Helix` wählen.
4. Gesamttiefe z. B. 3 mm, Helix-Zustellung 1 mm/U.
5. `Prüfen` muss PASS zeigen.
6. NC-Datei erzeugen und in NC View kontrollieren: sichtbare Helix-Zustellung, danach konzentrische Räumringe bis zur Fertigwand.
7. G-Code zusätzlich auf Rapid-Bewegungen im Material und korrekte Z-Endtiefe prüfen.

## Leitplanke

> Keine Ribbons mit tausend Buttons. Komplexität wächst innerhalb der bestehenden fachlichen Operation und nur dort, wo sie gebraucht wird.
