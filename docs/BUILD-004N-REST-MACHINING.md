# Build 004N — Restmaterial / Rest Machining

## Ziel

Pocket-Nachbearbeitung soll eine vorherige Taschenbearbeitung explizit referenzieren und mit einem kleineren Werkzeug nur die Bereiche bearbeiten, die durch den größeren Fräser geometrisch nicht vollständig erreicht wurden.

## Vertrag

- `PocketOperation.restMachiningEnabled`
- `PocketOperation.restFromOperationId`
- Quelle muss eine frühere aktivierte Pocket-Operation im selben Job sein.
- Folgewerkzeug muss kleiner als das Werkzeug der Quelle sein.
- Quelle und Folgeoperation müssen dasselbe Bearbeitungsziel verwenden:
  - STEP: gleiche `stepFaceId`
  - DXF: gleiche `contourId`
- Kein stiller Fallback auf eine Volltaschenbearbeitung bei ungültiger Restmaterial-Konfiguration.

## Geometrisches Modell

004N verwendet ein kanonisches Swept-Tool-Modell. Die vorherige Pocket-Bahn wird mit dem Radius des vorherigen Werkzeugs als bereits geräumter Bereich interpretiert. Die aktuelle Bahn wird segmentweise gegen diese Abdeckung geprüft. Ein Segment bleibt nur erhalten, wenn der kleinere Fräser dort über die bereits geräumte Fläche hinaus Material erreichen kann.

Der wirksame Vergleichsabstand ist:

`(vorheriger Werkzeugdurchmesser - aktueller Werkzeugdurchmesser) / 2`

Die aktuelle Bahn wird in zusammenhängende Restsegmente aufgeteilt. Bereits vollständig abgedeckte Abschnitte werden nicht erneut gepostet.

## Produktionssicherheit

Job-Preflight und Job-G-Code-Pfad verwenden dieselben Kernregeln. Ungültige Quelle, falsche Reihenfolge, anderes Pocket-Ziel oder ein nicht kleineres Folgewerkzeug führen zu FAIL.

Wenn nach der Swept-Tool-Prüfung kein Restmaterial übrig bleibt, wird keine unnötige Fräsbahn erzeugt; die Operation meldet dies als Hinweis.

## Scope 004N

Der erste Build arbeitet auf kanonischen 2.5D-Pocket-Pfaden und ist damit für DXF- und STEP-Taschen nutzbar. Ein späteres volumetrisches Stock-Modell kann denselben Vertrag erweitern, ohne die Operation neu zu definieren.

## Lokale Gates

```bash
pnpm check:004n
pnpm check
pnpm build
```

Native OCCT wurde nicht verändert; `pnpm native:test` ist für 004N nicht erforderlich.
