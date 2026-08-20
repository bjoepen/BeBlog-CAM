# BeBlog CAM — Build 001J

## Ziel

001J erweitert den in 001H/001I bewiesenen 2D-CAM-Kern um echte Taschen-Räumstrategien. Die bestehenden Kontur-, Carve-, Rechtecktaschen- und Multi-Operation-Pfade bleiben unverändert und dienen als Regression.

## Gate 8A — Kreistasche / konzentrische Räumstrategie

Status: **IMPLEMENTIERT / REALTEST AUSSTEHEND**

### Referenzidee

Eine native DXF-Kreiskontur soll nicht über ein rechteckiges Raster angenähert werden. Die CAD-Geometrie bleibt die fertige Taschenwand; daraus wird analytisch die maximal zulässige Fräsermittelbahn berechnet:

`R Werkzeugbahn außen = R Tasche − R Werkzeug`

Der Innenraum wird vom Zentrum nach außen über konzentrische Bahnen geräumt. Der äußerste Ring entspricht exakt der radiuskorrigierten Fertigwand.

### Räumstrategien in 04 · Bearbeiten

Tasche besitzt nun:

- `Automatisch`
- `Raster`
- `Kreis`

Gate-8A-Regeln:

- `Automatisch` erkennt eine native DXF-Kreiskontur und verwendet `Kreis`.
- Für andere Geometrien bleibt `Automatisch` beim bewiesenen Rechteck-Rasterpfad.
- `Raster` auf einer nativen Kreiskontur wird in Gate 8A bewusst abgelehnt.
- `Kreis` auf einer Nicht-Kreiskontur wird bewusst abgelehnt.
- Es gibt keine stille Fallback-Strategie.

### Kreistaschen-Mathematik

`src/lib/pocketMath.ts` enthält `buildCircularPocketPath(...)`.

Geprüft werden:

- positiver Taschenradius,
- positiver Werkzeugdurchmesser,
- Stepover > 0 und <= 100 %, 
- Werkzeug passt in die Tasche,
- maximaler Fräsermittelbahnradius,
- Anzahl konzentrischer Ringe,
- tatsächlicher Ringabstand <= gewünschtem Stepover.

Der letzte Ring wird numerisch exakt auf `R Tasche − R Werkzeug` gesetzt.

### G-Code

`src/lib/pocketGcode.ts` erzeugt für Kreistaschen native G2/G3-Bahnen.

Jeder konzentrische Ring wird wie bei den bereits bewiesenen nativen Kreisen aus zwei G3-Halbkreisen ausgegeben. Dadurch vermeiden wir Controller-Abhängigkeiten bei vollständigen 360°-Bögen.

Konservative Gate-8A-Strategie pro Z-Zustellung:

1. Safe-Z,
2. Kreismittelpunkt anfahren,
3. senkrecht auf Solltiefe eintauchen,
4. radial zum ersten Ring,
5. zwei G3-Halbkreise,
6. radial zum nächsten Ring,
7. wieder zwei G3-Halbkreise,
8. äußerster Ring = Wandumlauf,
9. zurück auf Safe-Z.

### Eintauchen

Gate 8A gibt für Kreistaschen zunächst ausschließlich `Senkrecht` frei.

Die bestehende lineare Rampe bleibt für den Rechteck-Rasterpfad unverändert verfügbar. Wird bei einer Kreistasche `Rampe` gewählt, setzt der Preflight die Operation bewusst auf FAIL. Eine helikale Kreiseintauchstrategie ist ein separates späteres Gate.

### Preflight

`05 · Prüfen` erkennt die Strategie ausdrücklich und zeigt bei einer Kreistasche:

- native Kreistasche und Durchmesser,
- maximalen Fräsermittelbahnradius,
- konzentrische Ringanzahl,
- tatsächlichen radialen Stepover,
- native G2/G3-Interpolation,
- äußersten Ring als radiuskorrigierte Fertigwand,
- Eintauchstrategie.

### Gate-8A-Realtest

PASS erst nach folgendem Test:

1. einfache DXF mit einer nativen Kreiskontur laden,
2. `Tasche` wählen,
3. Kreis als Sollkontur wählen,
4. `Automatisch` verwenden,
5. Werkzeug und Stepover festlegen,
6. `05 · Prüfen` muss geometrisch PASS bzw. nur aufgrund bekannter Rohlinghinweise WARN sein,
7. `.nc` exportieren,
8. G-Code muss konzentrische G3-Halbkreise enthalten,
9. NC Viewer und CAMotics müssen eine vollständig geräumte Kreistasche zeigen,
10. äußerster Fräsermittelbahnradius muss `R Tasche − R Werkzeug` entsprechen,
11. bestehende Rechtecktasche erneut testen; sie muss unverändert über Raster laufen.

Erst danach wird Gate 8A geschlossen.

## Danach

Gate 8B erweitert Taschen auf konturparallele Räumung für weitere geschlossene Geometrien. Erst wenn diese Strategien bewiesen sind, darf `Automatisch` über mehr als Kreis-vs-Rechteck entscheiden.

Danach folgt der eigenständige Meilenstein **Gate 9 — Bohren**.
