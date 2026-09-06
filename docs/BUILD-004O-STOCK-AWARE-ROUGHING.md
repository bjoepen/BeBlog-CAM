# Build 004O — Stock-aware Roughing / Adaptive Clearing v1

## Ziel

004O ergänzt die Taschenbearbeitung um eine erste materialbewusste Schruppstrategie. Der Build versucht ausdrücklich **nicht**, komplexe trochoidale oder proprietäre Adaptive-Algorithmen anderer CAM-Systeme nachzubauen. Stattdessen wird der bestehende kanonische Pocket-Toolpath gegen ein innerhalb der Operation fortgeschriebenes Modell bereits geräumter Werkzeugkorridore geprüft.

## Vertrag

Eine PocketOperation kann `stockAwareRoughingEnabled` und `maxRadialEngagementPercent` setzen. Standard ist Aus; die konservative Vorgabe für maximale radiale Werkzeugbelastung liegt bei 35 % des Werkzeugdurchmessers.

Für jede Z-Ebene gilt:

1. Die erste Werkzeugbahn ist der definierte Initialschnitt dieser Ebene und verwendet weiterhin den bestehenden sicheren Plunge-, Ramp- oder Helix-Einstieg.
2. Danach wird jede weitere Bahn gegen die bereits geräumten Bahnsegmente derselben Z-Ebene geprüft.
3. Bereits vollständig geräumte redundante Bahnen können entfallen.
4. Überschreitet der notwendige radiale Abstand zur geräumten Bahn den konfigurierten Grenzwert, wird der Werkzeugweg gesperrt. Es gibt keinen stillen Vollnut-Fallback.
5. Der freigegebene kanonische Pfad wird direkt gepostet; STEP und DXF verwenden denselben Kernel.

## Abgrenzung

004O ist Adaptive Clearing **v1**. Nicht Bestandteil dieses Builds sind trochoidale Schleifen, dynamische Feed-Modulation, exakte volumetrische Stock-Simulation, Holder-/Fixture-Kollision oder Reststock zwischen unterschiedlichen 3D-Operationen. Diese Themen bleiben nachfolgende Ausbaustufen.

Restmaterial aus 004N und Stock-aware Roughing dürfen in 004O nicht gleichzeitig auf derselben PocketOperation aktiv sein. Die beiden Modelle besitzen unterschiedliche Bezugszustände und werden erst in einer späteren Ausbaustufe sauber kombiniert.

## Gates

```bash
pnpm check:004o
pnpm check
pnpm build
```

Keine OCCT-/C++-Änderungen; `pnpm native:test` ist für 004O nicht erforderlich.
