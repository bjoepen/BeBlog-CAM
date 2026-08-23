# STEP View implementation note

Der 001Z-View-Build ist ausschließlich eine Darstellungsgrundlage vor Z-Level-Roughing. Die CAM-Geometrie bleibt unverändert.

Geplante Datenrollen:

- `displayVertices`: Dreieckspunkte für gefüllte Flächen.
- `displayEdges`: separat aus OCCT abgeleitete echte BRep-Kanten für das CAD-Kantenoverlay.
- STEP/BRep selbst bleibt außerhalb dieser Darstellungsdaten die geometrische Source of Truth.

Die beiden Darstellungsrepräsentationen dürfen weder Projektpersistenz noch Werkzeugwegdefinitionen ersetzen.
