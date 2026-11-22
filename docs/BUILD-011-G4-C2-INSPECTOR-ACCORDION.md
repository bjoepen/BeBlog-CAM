# BUILD 011-G4-C2 – Task-oriented Inspector Accordion

## Scope and decisions

The 04 · Bearbeiten inspector now groups its existing controls in three independently collapsible native HTML `<details>` sections. No tabs, subview routing, CAM operation behavior, toolpath calculation, NC generation or project format changed. The shared `InspectorShell` and G4-B2 resize behavior are unchanged.

The operations job list, active operation type selector, add/remove actions and active-operation/selection summary remain before the accordions. The currently populated application error is also rendered there with `role="alert"`. The target status is repeated in the first accordion summary so a collapsed section still describes the current operation's target state.

Initial disclosure state: **Ziel & Geometrie** and **Werkzeug & Schnittdaten** open; **Strategie & Details** closed. Each section is an independent native disclosure. Switching the selected operation replaces only the operation-specific children inside these stable sections. The disclosure open states therefore remain as-is during an operation switch. The current CAM state remains owned by `App.svelte`; the accordion has no duplicate form model or toggle handler. Moving to another work step unmounts the Bearbeiten branch, so returning starts from the declared initial disclosure state.

## Existing field mapping

| Section | Existing controls grouped here | Notes |
| --- | --- | --- |
| Persistent header | Job operation list, active operation selection, operation kind selector, add groups, remove buttons, global error, active operation name and target selection summary | Required selection state is visible without opening details. List and action handlers are unchanged. |
| Ziel & Geometrie | Facing target and stock-face context; DXF carve geometry/layer selection; drill target selection; STEP/DXF contour or pocket target instructions and selection status; trochoid contour target; Z-level model/face target and islands; selected 3D roughing/surface finishing faces | Geometry overlays and `GeometryView` callbacks remain outside the inspector and unchanged. Existing direct STEP face, wire and hole ID bindings remain in `App.svelte`. |
| Werkzeug & Schnittdaten | Tool diameter/type information and common cutting data: total depth when applicable, step-down, feed, plunge feed, spindle speed and safety Z | The existing conditionals for stock-bottom depth, Z-level and 3D operations remain unchanged. Summary includes tool diameter, speed, feed and the applicable depth/step-down state. |
| Strategie & Details | Drill method and depth mode; facing direction/stepover; trochoid side/direction/radius/advance/ramp/allowances; contour topology, side/direction, depth, tabs, allowances/finish passes and lead; pocket through-cut allowance, strategy, stock-aware and rest machining, stepover, entry and allowances; Z-level stepover; 3D direction/stepover/allowance; surface-finishing direction/stepover and its limitation note | Existing strategy-specific controls and their current conditionals/bindings are retained. |

The `dxfNoStockDrillGuard` integration continues to find `.placement-section`, `.placement-title` with `Bohrtiefe`, and the `Manuell` / `Durch Rohling` actions. Existing `.inspector` labels/notes and controls expected by `toolpath25dControl.ts` remain in the Bearbeiten content. STEP/DXF selection semantics and viewport selection callbacks are unchanged.

## Closed summaries

`src/lib/editingAccordionSummary.ts` computes deterministic summaries directly from the currently selected `CamOperation` and import kind. Target summaries report selection counts or a missing-selection prompt. The tool/cut summary reports the configured diameter, RPM, feed, and relevant depth/step-down. Strategy summaries report the selected strategy/direction and key setting. No field value is copied into new persistent state.

## Tests and acceptance evidence

`pnpm check:011g4c2` compiles the Svelte component and verifies three independent native details elements, permanent actions and status, all operation-kind summaries, STEP/DXF selection hooks, DOM guard selectors, preserved resizing/full-page tool view, and operation switching with distinct geometry and form values retained in the actual `operationsProject.selectOperation()` implementation.

Automated tests do not replace native UI acceptance. In particular, keyboard activation and visual summaries at 330 px and 650 px still need manual confirmation in the application.
