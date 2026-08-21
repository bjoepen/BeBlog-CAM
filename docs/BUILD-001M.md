# BeBlog CAM — Build 001M

## Ziel

001M baut den bisher noch leeren Workflow-Schritt **03 · Werkzeuge** aus. Ausgangspunkt ist der bewährte Rechner **Drehzahl & Vorschub** aus `bjoepen/beblog-maker-tools`.

Der Werkzeugschritt soll nicht zu einem Maschinenbau-CMS werden. Er bleibt Teil der linearen BeBlog-CAM-UX und beantwortet zunächst eine konkrete Frage:

**Mit welchen nachvollziehbaren Ausgangswerten für Drehzahl und Vorschub kann eine typische Hobby-CNC beginnen?**

## Gate 11A — Rechenkern aus Maker Tools

Status: **IMPLEMENTIERT / UX-VERDRAHTUNG AUSSTEHEND**

### Übernommene Mathematik

Der Rechenkern wurde bewusst unverändert aus dem Maker-Tools-Prinzip übernommen:

`n = (vc × 1000) / (π × d)`

`vf = n × z × fz`

mit:

- `d` Werkzeugdurchmesser in mm,
- `vc` Schnittgeschwindigkeit in m/min,
- `z` Schneidenzahl,
- `fz` Zahnvorschub in mm,
- `n` Spindeldrehzahl in 1/min,
- `vf` Vorschub in mm/min.

Neue Datei:

- `src/lib/feedsSpeeds.ts`

### Transparenzregel

Gate 11A enthält ausdrücklich **keine versteckten Materialtabellen, Maschinenfaktoren oder automatischen Sicherheitsabschläge**.

Die Ausgabe ist zunächst ein mathematisch nachvollziehbarer Ausgangspunkt. Das entspricht der ursprünglichen Maker-Tools-DNA und verhindert eine scheinbar präzise Empfehlung, deren Annahmen der Nutzer nicht sehen kann.

### Vorbereitete UX

Neue Komponente:

- `src/lib/FeedsSpeedsCalculator.svelte`

Eingaben:

- Werkzeugdurchmesser,
- Schnittgeschwindigkeit,
- Schneidenzahl,
- Zahnvorschub.

Ausgaben:

- rechnerische Spindeldrehzahl,
- rechnerischer Vorschub.

Die Formel bleibt in der Oberfläche sichtbar.

## Gate 11B — Hobby-CNC-Empfehlungs-Layer

Nach dem reinen Rechenkern soll ein separater, transparenter Empfehlungs-Layer folgen. Dieser darf den mathematischen Basiswert nicht überschreiben, sondern muss seine Eingriffe sichtbar machen.

Vorgesehen sind insbesondere:

- frei definierbare Spindelgrenze,
- frei definierbare Vorschubgrenze,
- optionaler konservativer Maschinenfaktor,
- Material-/Werkzeug-Hinweise erst nach klar dokumentierter Datenbasis,
- Anzeige `rechnerisch` versus `für Maschinenprofil begrenzt`,
- spätere Übernahme der freigegebenen Werte in die aktive CAM-Bearbeitung.

Damit bleibt nachvollziehbar, ob ein Wert aus der Zerspanungsformel oder aus einer Grenze der Hobby-CNC stammt.

## Sicherheitsprinzip

Ein Schnittdatenrechner liefert **Startwerte, keine Garantie**. BeBlog CAM muss dies auch in der UX klar kommunizieren. Werkzeugherstellerangaben, Material, Auskragung, Maschinensteifigkeit, Spindelleistung und Aufspannung bleiben reale Grenzen.

## Bezug zu 001L

001L bleibt parallel auf **SEMI-PASS**, bis der geplante Real-World-Test mit dem Estlcam-Postprozessor durchgeführt und die reale Fräsgeometrie vermessen wurde.

Die Werkzeugentwicklung in 001M verändert keine Werkzeugwege und keinen Postprozessor aus 001L.
