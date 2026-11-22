# BUILD 011-G4-C3 – Prüfen-Inspector: Advisor-Konsolidierung

## Umfang

Der Prüfen-Inspector zeigt zuerst den bestehenden Job-Preflight. Danach folgt genau eine führende Karte je Feature aus der aktuellen G1/G2-Übersicht. Die Karte zeigt Merkmalsart, verfügbare Geometriemaße, Erkennungsstatus, qualitative Evidenz, Advisor-Coverage und – sofern eine aktuelle, eindeutige Feasibility-Zuordnung existiert – Werkzeug-/Verfahrenskandidaten, Schnittwerte und bedingte Operationsvorschläge.

Der Kartenaufbau wird in `buildStepAdvisorFeatureCards()` aus `stepAdvisorInspector.ts` erzeugt. Er übernimmt die G1/G2-Reihenfolge und Feature-IDs. Für nicht bewertete oder fehlgeschlagene Übersichten werden keine Kandidaten oder Vorschläge angehängt. Jede Karte behält die Feature-ID als `data-feature-id` und als zurückhaltend dargestellte interne Zuordnung. Technische Face-/Wire-/Edge-Referenzen, Geometrieevidenz, Interpretationen, Einschränkungen und vollständige Advisor-Begründungen liegen in standardmäßig geschlossenen nativen Disclosure-Elementen.

## Zuordnung von Kandidaten, Schnittdaten und Vorschlägen

Die vorhandene `buildStepAdvisorFeatureDetails()`-Zuordnung bleibt maßgeblich. Kandidat und Schnittdaten werden anhand von Feature-ID, Werkzeug-ID, Methode und eindeutiger, namensgleicher Schnittdatenidentität verbunden. Mehrdeutige oder inkonsistente Werte bleiben unverknüpft.

Operationsvorschläge werden pro Zeile nur verbunden, wenn Feature-ID, Werkzeug-ID, Methode, Werkzeugname sowie Drehzahl und Vorschub eindeutig mit dem bereits validierten Schnittdatenkandidaten übereinstimmen. Doppelte oder widersprüchliche Vorschläge werden nicht nach Arrayposition ausgewählt und bleiben als nicht zuordenbare Diagnose in den Details sichtbar. Proposal Reviews werden nur bei eindeutig zugeordnetem Vorschlag und eindeutiger Feature-/Werkzeug-/Methodenidentität angezeigt. Hinweise, die bereits als Kandidaten- oder Schnittdatenhinweise erscheinen, werden nicht nochmals als Vorschlagseinschränkung wiederholt.

Kandidaten ohne vollständigen Vorschlag bleiben als Kandidaten sichtbar. Nicht bewertete Merkmale zeigen „Noch keine Bearbeitungsempfehlung verfügbar“. Ein fehlgeschlagener oder veralteter Feature-Overview zeigt einen Fehlerzustand und keine früheren Karten.

## Job-Preflight

Die bestehende `JobPreflightPanel`-Berechnung bleibt unverändert und wird in `App.svelte` vor dem STEP Advisor gerendert. Der Gesamtstatus PASS/WARN/FAIL bleibt offen sichtbar. Jede Operation zeigt im geschlossenen Zustand ihren Status, Namen, den ersten Blocker beziehungsweise Hinweis sowie die Anzahl weiterer Meldungen. Operationsdetails, kanonische Werkzeugbahn-Informationen, Werkzeugbaugruppe, Spannmittel-, Spindelkopf- und Maschinenraumdiagnosen sowie sämtliche Warnungen und Fehler sind im nativen Disclosure vollständig verfügbar.

Der Preflight konsumiert weiterhin ausschließlich tatsächliche Projektoperationen. Advisor-Vorschläge verändern weder Operationen noch Produktions- oder NC-Freigabe.

## Entfernte Darstellungsredundanz und erhaltene Inhalte

- Die bisherige G1/G2-Featureübersicht und die separate Advisor-Feasibility-Featureliste sind zu einer Feature-ID-gekeyten Kartenliste zusammengeführt.
- Werkzeugkandidaten, Schnittwerte und zugehöriger bedingter Operationsvorschlag stehen innerhalb derselben Featurekarte und Werkzeug-/Methodenzeile.
- Allgemeine Advisor-Hinweise, nicht eindeutig zuordenbare Werte und ausführliche Geometrie-/Klassifikationsdetails bleiben bei Bedarf abrufbar.
- Geometrische Erkennung, Advisor-Coverage, Werkzeugkandidat, bedingter Operationsvorschlag und Job-Preflight bleiben separat beschriftete Statusstufen.
- Alle sechs G1/G2-Geometriearten werden aus der gelieferten Übersicht gerendert; die UI verwirft keine Feature-Art.

## Unveränderte Sicherheitsgrenzen

G1/G2-Erkennung, Feasibility-Berechnung, Werkzeugmatching, Schnittdatenberechnung, Vorschlagsbildung, Proposal Review und Job-Preflight wurden nicht geändert. `CONDITIONAL` bleibt unverbindlich. Ein Vorschlag wird nicht in eine CAM-Operation übernommen. Advisor-Coverage ist kein Preflight-Status. Es wurden keine Viewport-Auswahl-/Highlight-Funktionen ergänzt; diese sind für 011-G4-D vorgesehen. Eine vollständige Übersetzung der Engine-Texte bleibt 011-G4-C4 vorbehalten.

## Tests und Abnahme

`check:011g4c3` prüft die einzelne Featureliste, alle sechs Feature-Arten, den Fehler-/Stale-Zustand, exakte Kandidaten-/Vorschlags-/Review-Zuordnung, nicht zuordenbare oder fehlende Vorschläge, sichtbare und geschlossene Preflight-Diagnosen, die Preflight-Reihenfolge und die Trennung von Projektoperationen und Advisor-Daten. Die bestehenden F1–F6- und G3-Gates wurden auf die konsolidierte Darstellung angepasst; ihre Rechen-, Identitäts- und Fail-closed-Prüfungen bleiben erhalten.

Automatisierte Tests kompilieren die betroffenen Svelte-Komponenten und testen die pure Zuordnungslogik. Die manuelle Sichtprüfung in nativer Tauri/WebKit-Ansicht bleibt erforderlich, insbesondere bei Inspectorbreiten von **330, 520 und 650 px**: Lesbarkeit der Kandidatenzeilen, sichtbare PASS/WARN/FAIL-Blocker, Disclosure-Bedienung und Scrollverhalten.

## Review-Follow-up zu PR #177

Die Werkzeug-/Methodenzeilen richten ihr Reflow nun über einen benannten CSS-Container (`advisor-inspector`) an der tatsächlichen Inspector-Inhaltsbreite aus. Bei schmalen Containern belegt der Werkzeugname eine volle Zeile; Methode und Schnittwerte liegen darunter in zwei flexiblen, umbrechbaren Spalten. Damit ist auch der kompakte 330-px-Modus abgedeckt, unabhängig von der Fensterbreite. Die Sichtprüfung bei 330, 520 und 650 px bleibt ein manueller Tauri/WebKit-Abnahmepunkt.

`buildStepAdvisorFeatureCards()` baut pro Präsentationsakt einen gemeinsamen Index für Matches, Schnittdaten, Vorschläge und Reviews. Jede Eingabeliste wird einmal traversiert; Identitäts-Buckets behalten Duplikate und Reihenfolge bei. Die bisherigen Eindeutigkeits-, Namens-, Methoden-, Messwert- und Review-Prüfungen bleiben fail-closed. Doppelte oder widersprüchliche Daten werden nicht anhand ihrer Position aufgelöst. Das erweiterte `check:011g4c3` prüft große Eingaben, einmalige Listendurchläufe, unveränderte Inputs und identische Kartenergebnisse gegenüber der Feature-Detail-Referenz, dazu doppelte Advice- und Review-Zuordnungen.
