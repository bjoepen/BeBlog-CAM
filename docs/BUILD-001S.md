# BeBlog CAM 001S — Material Context & Cutting Data Foundation

## Ziel

001S macht den Werkstoff zu einem echten CAM-Kontext. Die bisher vorbereiteten Materialgruppen **Holz / MDF**, **Kunststoff**, **Aluminium** und **Stahl** sind auswählbar und beeinflussen erstmals die Berechnung von Drehzahl und Vorschub.

Der Werkstoff gehört semantisch zum Rohling. Werkzeugdaten bleiben davon getrennt.

## Materialkontext

Der Materialzustand liegt in `src/lib/materialContext.ts` und wird lokal unter `beblog-cam.stock-material.v1` gespeichert.

Verfügbare Gruppen:

| Material | vc-Startprofil | fz-Faktor |
| --- | ---: | ---: |
| Holz / MDF | 250 m/min | 1,00 |
| Kunststoff | 180 m/min | 0,80 |
| Aluminium | 120 m/min | 0,65 |
| Stahl | 50 m/min | 0,35 |

Diese Werte sind **Startprofile für 001S**, keine universellen Herstellerdaten. Sie schaffen eine nachvollziehbare Materialabhängigkeit; die fachliche Härtung und spätere Verfeinerung der Materialdaten gehört in einen Folge-Build.

## Berechnungslogik

Der vorhandene mathematische Kern bleibt unverändert:

- `n = (vc × 1000) / (π × d)`
- `vf = n × z × fz`

001S ergänzt davor sichtbar:

- `fz_material = fz_werkzeug × Materialfaktor`

Die ausgewählte Materialgruppe liefert außerdem den Startwert für `vc`. Der Nutzer darf `vc` und den Werkzeug-Basiswert `fz` weiterhin bewusst ändern.

## Transparenzregel

Ein Materialwechsel verändert **nicht automatisch** eine bereits angelegte CAM-Bearbeitung.

Die aktive Operation erhält Werkzeug, Durchmesser, berechnete Drehzahl und berechneten Vorschub weiterhin ausschließlich über den vorhandenen Button **„Werkzeug & Schnittdaten übernehmen“**.

Damit bleiben drei Ebenen getrennt:

1. Werkzeugdaten
2. Werkstoff-/Rohlingkontext
3. explizit in eine Operation übernommene Schnittdaten

## UI

- Auf **Rohling** erscheint eine echte Werkstoffauswahl.
- In **Werkzeuge → Werkzeugdaten** wird der aktive Werkstoffkontext sichtbar.
- In **Werkzeuge → Drehzahl & Vorschub** ist die Materialauswahl ebenfalls sichtbar und synchron mit dem Rohling.
- Aktiver Werkstoff, vc-Startprofil, fz-Faktor und wirksamer Zahnvorschub werden transparent angezeigt.
- Die Werkzeugbibliothek speichert weiterhin keine Materialwerte.

## Technischer Integrationspunkt

Der bestehende App-Shell-Stand rendert die Hauptnavigation zentral in `App.svelte`. 001S bindet `StockMaterialSelector.svelte` über denselben post-mount Shell-Integrationspunkt ein, der bereits für persistente UI-Erweiterungen verwendet wird. Der Materialzustand selbst ist davon unabhängig und liegt in `materialContext.ts`.

Eine spätere Projektpersistenz kann diesen Zustand direkt in das Setup-/Stock-Modell übernehmen, ohne die Berechnungslogik erneut zu ändern.

## Gates

### Gate S1 — Materialauswahl

- Rohling öffnen.
- Alle vier Materialgruppen müssen auswählbar sein.
- Auswahl bleibt beim Wechsel der Workflow-Schritte erhalten.

### Gate S2 — Synchronität

- Auf Rohling z. B. `Aluminium` wählen.
- Zu Werkzeuge → Drehzahl & Vorschub wechseln.
- Dort muss `Aluminium` aktiv sein.
- Wechsel in Werkzeuge muss wiederum auf Rohling sichtbar bleiben.

### Gate S3 — Materialeinfluss

Mit unverändertem Werkzeug nacheinander Holz/MDF, Kunststoff, Aluminium und Stahl wählen.

Erwartung:

- `vc` wechselt auf das jeweilige Startprofil.
- wirksamer `fz` ändert sich mit dem Materialfaktor.
- Drehzahl und/oder Vorschub ändern sich nachvollziehbar.

### Gate S4 — Keine implizite Operation-Änderung

- Eine Bearbeitung mit vorhandenen Schnittdaten öffnen.
- Material wechseln.
- Bearbeitung kontrollieren: ihre Werte dürfen sich noch nicht ändern.
- Erst **„Werkzeug & Schnittdaten übernehmen“** betätigen.
- Danach müssen die materialbezogenen Werte in der aktiven Operation ankommen.

### Gate S5 — Werkzeugbibliothek

- Werkzeug speichern und neu laden.
- Material wechseln.
- Werkzeuggeometrie, Schneidenzahl und Werkzeug-Basis-fz bleiben Werkzeugdaten.
- Material wird nicht als Werkzeugpreset gespeichert.

### Gate S6 — Regression

```bash
pnpm check
pnpm build
```

Beide Befehle müssen PASS liefern.

Danach visueller Test über:

```bash
pnpm tauri dev
```

## Nicht Bestandteil von 001S

- konkrete Werkstoffsorten wie EN AW-6082, POM oder Multiplex
- Hersteller-/werkzeugspezifische Materialtabellen
- automatische Zustelltiefen oder Stepover-Werte aus dem Material
- automatische Änderung bestehender Operationen
- vollständige Projektpersistenz des Rohling-Setups

Diese Punkte werden erst nach dem Material-Fundament verfeinert.
