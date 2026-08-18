# BeBlog CAM — Product DNA

## Leitmotiv: Klarheit

> Klarheit ist nicht weniger Information. Klarheit ist Information zur richtigen Zeit.

BeBlog CAM follows a maker-first workflow. Technical depth is preserved, but internal CAM complexity must never dictate the interface.

## UX grammar

The permanent primary flow is:

**Bauteil → Rohling → Werkzeuge → Bearbeiten → Prüfen → Fräsen**

This left-hand sequence is the stable workflow backbone of BeBlog CAM. It represents the logical work steps of a hobby maker and is not a temporary navigation concept to be replaced as the application grows.

**The left side stays simple. Complexity grows contextually on the right.**

The workpiece remains the visual center of the application. A contextual inspector exposes only the decisions relevant to the current step.

> **BeBlog CAM zeigt einen Arbeitsablauf, keine Werkzeugkiste.**

Functions appear where they are needed in the machining workflow. BeBlog CAM must not accumulate permanent toolbars, nested menus or settings shown merely because the CAM engine supports them.

## Binding principles

- Estlcam-like immediacy, combined with the calmer visual quality of eCam.
- Progressive disclosure instead of separate basic/expert modes.
- No cryptic CAM object tree as the primary navigation model.
- No ribbon of dozens of operations.
- No modal-dialog maze.
- Expert parameters remain reachable without becoming default noise.
- Geometry/kernel terminology such as BRep, tessellation, drop-cutter or push-cutter stays internal unless it genuinely helps diagnose a problem.
- Every build must already look and behave like a piece of BeBlog CAM; usability and visual clarity are not deferred to a later polish phase.
- New CAM capabilities must integrate into the six-step workflow rather than create additional permanent navigation categories by default.
- A technically more capable BeBlog CAM must not automatically become a visually more complicated BeBlog CAM.

## Maker principle

The user should understand what will happen to the workpiece and why, without first having to understand how the CAM engine is implemented.

BeBlog CAM is designed from the perspective of a hobby maker rather than an industrial CAM department. The interface should make the common path enjoyable and obvious while preserving technical correctness underneath.

The target experience is intentionally linear: the user should be able to progress through a machining job without searching through toolbars, deep submenus or unrelated parameters.

## Contextual inspector — controlled growth

The right-hand inspector is intentionally allowed to become richer as real machining capabilities are added. This is where operation-specific decisions belong.

Examples of future parameters include:

- plunge strategy and plunge angle,
- ramping or helical entry where geometrically applicable,
- lead-in / lead-out,
- tabs and holding strategy,
- stepover and stepdown,
- operation-specific feeds and speeds,
- tool-change-related parameters,
- other parameters that are genuinely required by the active machining operation.

This growth must follow progressive disclosure. A parameter appears because the current operation needs it, not because it exists somewhere in the CAM engine.

Defaults should support a conservative hobby-CNC workflow. Advanced controls remain accessible when useful, but must not turn the default inspector into an expert-control wall.

## UX protection rule

The current early-stage workflow is already considered a proven product characteristic, not disposable prototype UI.

Future development must therefore protect these properties:

1. the six logical steps remain immediately understandable;
2. the workpiece remains visually central;
3. the right inspector remains contextual;
4. common jobs require few decisions;
5. additional capability is revealed progressively;
6. `Prüfen` remains a visible, understandable safety step before machine output;
7. internal mathematical and geometric complexity does not leak into routine operation.

A proposed feature that cannot fit this grammar should first be reconsidered architecturally before adding another permanent button, menu or workflow level.

## Core mental model

> Part lives in stock. Stock lives on the machine.

This maps to the technical transform chain:

**Part → Stock → WCS → Machine**

Stock may be larger than the part and may be mounted slightly rotated. Later probing workflows therefore measure the real stock, not the CAD part.
