# Development 011-G4-B – Adaptive Inspector Layout Foundation

## Scope

This change adds one shared layout shell around the existing right-inspector contents for Bauteil, Rohling, Werkzeuge, Bearbeiten, Prüfen and Fräsen. Existing step content, App-owned CAM state, handlers, calculations, project persistence and DOM selectors remain in place. No tabs or task subviews are introduced.

## Original layout decisions (superseded by 011-G4-B2)

- The initial default width was **330 px**; the initial expanded preset was **520 px**.
- The initial pointer and keyboard resizing range was **330–650 px**.
- The normal workspace keeps a **450 px minimum 3D viewport**, matching the existing minimum-window layout: at a 980 px window, the 150 px workflow rail and the previous 380 px inspector left 450 px for the viewer. Its usable inspector width is clamped against the measured workspace width (`workspace width − 450 px`), then against 330–650 px. Compact mode therefore fits; expanded/custom widths reduce as needed near the window boundary.
- At the 980 px minimum window size, the current 150 px rail leaves an 830 px workspace: a 520 px request is rendered at 380 px, leaving 450 px for the viewport. At a 1100 px window, the 150 px rail leaves 950 px: the 520 px request is rendered at 500 px, again leaving 450 px. At wider sizes, custom mode can reach 650 px while retaining the viewport minimum.
- The separator is keyboard focusable. Left/Right change width by 16 px, Shift+Left/Right by 64 px, and Home/End go to the current minimum/maximum. Pointer dragging and keyboard changes share the same clamp.
- The initial mode and requested width were stored under `beblog-cam.inspector-layout.v1` in local storage, independently of `.beblogcam` project data. 011-G4-B2 retains this key and reads those mode-tagged values as a plain requested width.
- The existing Werkzeug full-workspace behavior remains: its CSS still hides the 3D viewport and expands the tool calculator to the available window area.
- Existing inspector and nested scroll containers remain; the sticky controls from this initial version were removed in 011-G4-B2.

## State and integration boundary

`InspectorShell.svelte` owns presentation controls only. Its requested width is bound to UI-only variables in `App.svelte`; a `ResizeObserver` measures the workspace so the displayed width follows window changes. CAM setup, operation selection, Advisor context, preflight and NC state remain owned by the existing App/components. The shell preserves the `.inspector` element and descendants so current integrations in `toolpath25dControl.ts`, `dxfNoStockDrillGuard.ts` and the runtime extensions continue to find their existing targets.

The preference write is isolated to the layout control callback and never enters project serialization. Storage errors do not block navigation or the tool workflow.

## Automated acceptance

`pnpm check:011g4b` covers default and legacy preference values, preference validation and storage failure, resize clamping at workspace boundaries, keyboard increments, Svelte compilation, all six step branches, viewport minimum, the Werkzeug full-workspace CSS contract, DOM selector preservation and separation from project persistence.

This repository has no browser component-test harness. Pointer capture, keyboard focus/announcements, actual responsive appearance and retained unsaved form values therefore still require manual UI acceptance after CI. The focused gate exercises the shared resize and preference logic directly and compiles the actual Svelte shell and App.

## Remaining review points

- Verify resizing at the supported minimum window size and at 1100 px / wide desktop sizes in the target WebKit/Tauri shell.
- Confirm the divider remains centered and does not interfere with dynamically mounted material controls or the tools full-workspace view.
- Confirm screen-reader announcement of the separator's current value in the app's WebKit version.
