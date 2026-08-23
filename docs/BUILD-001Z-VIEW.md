# BeBlog CAM 001Z View Foundation

## Ziel

Vor dem ersten 3D-Z-Level-Roughing wird die STEP-Darstellung von einer sichtbaren Tessellations-/Debugdarstellung zu einer ruhigen CAD-artigen Ansicht weiterentwickelt.

## Verbindliche Regeln

- Exaktes OCCT-BRep bleibt Source of Truth.
- Die Triangulation dient nur der gefüllten Flächendarstellung und später ausgewählten CAM-/Simulationsaufgaben.
- Interne Triangulationskanten sind im normalen Viewport nicht sichtbar.
- Echte BRep-Kanten werden separat aus OCCT übertragen und als ruhiges CAD-Kantenoverlay dargestellt.
- Rohling, Aufspannebene, WCS und XYZ-Achsen bleiben erhalten.
- Orbit, Pan und Zoom bleiben unverändert verfügbar.
- CAM-Werkzeugbahnen müssen visuell deutlich über Modellkanten stehen.
- Ein späterer Mesh-Debugmodus darf die Triangulation sichtbar machen; er ist ausdrücklich nicht Standard.
- Ein manuell herangezoomter Screenshot ist kein Anlass für Auto-Fit-, Zoom- oder Kameraänderungen. Die Nutzeransicht bleibt unter Kontrolle des Anwenders.

## Abnahme

Referenz: `CBG Headstock v1.step`

1. STEP wird mit `pnpm native:dev` als natives OCCT-BRep geladen.
2. Das Bauteil erscheint als gefüllter 3D-Körper ohne sichtbares Dreiecksnetz.
3. Reale Modellkanten bleiben erkennbar.
4. Rohling und WCS bleiben eindeutig, aber sekundär.
5. Orbit/Pan/Zoom funktionieren weiterhin.
6. Die bekannten Referenzdaten bleiben erhalten: 16 Flächen, 72 Kanten, 2 Volumenkörper.
7. DXF-Darstellung und 2.5D-CAM bleiben unverändert.

## Real-World-Abnahme — 2026-08-23

Der Referenztest mit `CBG Headstock v1.step` ist visuell PASS:

- gefüllter CAD-Körper statt Tessellations-Drahtgitter,
- Bohrungen, Außenform und verrundeter Übergang sind eindeutig als reale Modellgeometrie lesbar,
- echte BRep-Kanten sind von Flächen und Rohling unterscheidbar,
- Rohling/WCS bleiben sekundäre Setup-Information,
- 16 Flächen, 72 Kanten und 2 Volumenkörper werden weiterhin erkannt,
- der im Abnahmescreenshot große Modellmaßstab entstand durch bewusstes Heranzoomen und ist kein Viewport-Fehler.

Damit ist die View Foundation als Grundlage für spätere Z-Level-Schnitt- und Werkzeugbahn-Overlays fachlich freigegeben.

## Nicht Bestandteil

- Z-Level-Roughing selbst
- Werkzeugbahnen auf STEP-Flächen
- Stock-Simulation
- Kollisionsberechnung
- WebGL-/Three.js-Wechsel
