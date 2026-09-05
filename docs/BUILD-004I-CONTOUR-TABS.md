# Build 004I — Haltestege / Tabs

## Ziel
Geschlossene DXF- und STEP-Konturen können beim Durchtrennen Reststege stehen lassen, damit das Werkstück sicher im Rohling bleibt.

## Vertrag
`ContourOperation` besitzt opt-in `tabsEnabled` sowie `tabCount`, `tabWidthMm` und `tabHeightMm`. Default: aus, 4 Stück, 6 mm breit, 1,5 mm Resthöhe.

## Gemeinsame Wahrheit
DXF und STEP laufen nach der jeweiligen Konturgeometrie durch denselben `applyContourTabs()`-Transformer auf dem Canonical Contour Toolpath.

## Verhalten
Oberhalb der Tab-Resthöhe bleiben Zustellungen unverändert. Tiefere Zustellungen werden an gleichmäßig verteilten Tab-Fenstern auf die Resthöhe angehoben. Offene Konturen werden fail-closed abgewiesen.

## Bearbeiten-UI
Im Kontur-Inspector stehen Haltestege Aus/Aktiv sowie Anzahl, Breite und Resthöhe direkt zur Verfügung.

## Scope 004I
Die erste robuste Version verteilt Tabs automatisch gleichmäßig. Manuelles Verschieben einzelner Tabs ist ein späteres UX-Upgrade; die Fertigungssemantik ist bereits operation-owned.
