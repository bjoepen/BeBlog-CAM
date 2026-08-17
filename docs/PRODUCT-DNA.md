# BeBlog CAM — Product DNA

## Leitmotiv: Klarheit

> Klarheit ist nicht weniger Information. Klarheit ist Information zur richtigen Zeit.

BeBlog CAM follows a maker-first workflow. Technical depth is preserved, but internal CAM complexity must never dictate the interface.

## UX grammar

The permanent primary flow is:

**Bauteil → Rohling → Werkzeuge → Bearbeiten → Prüfen → Fräsen**

The workpiece remains the visual center of the application. A contextual inspector exposes only the decisions relevant to the current step.

## Binding principles

- Estlcam-like immediacy, combined with the calmer visual quality of eCam.
- Progressive disclosure instead of separate basic/expert modes.
- No cryptic CAM object tree as the primary navigation model.
- No ribbon of dozens of operations.
- No modal-dialog maze.
- Expert parameters remain reachable without becoming default noise.
- Geometry/kernel terminology such as BRep, tessellation, drop-cutter or push-cutter stays internal unless it genuinely helps diagnose a problem.
- Every build must already look and behave like a piece of BeBlog CAM; usability and visual clarity are not deferred to a later polish phase.

## Maker principle

The user should understand what will happen to the workpiece and why, without first having to understand how the CAM engine is implemented.

## Core mental model

> Part lives in stock. Stock lives on the machine.

This maps to the technical transform chain:

**Part → Stock → WCS → Machine**

Stock may be larger than the part and may be mounted slightly rotated. Later probing workflows therefore measure the real stock, not the CAD part.
