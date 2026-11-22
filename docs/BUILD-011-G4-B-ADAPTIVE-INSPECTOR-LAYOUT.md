# Development 011-G4-B – Adaptive Inspector Layout Foundation

## Scope

This change adds one shared layout shell around the existing right-inspector contents for Bauteil, Rohling, Werkzeuge, Bearbeiten, Prüfen and Fräsen. Existing step content, App-owned CAM state, handlers, calculations, project persistence and DOM selectors remain in place. No tabs or task subviews are introduced.

## Layout decisions

- Compact mode requests **330 px**.
- Expanded mode requests **520 px**.
- Pointer and keyboard resizing use the **330–650 px** range.
- The normal workspace keeps a **450 px minimum 3D viewport**, matching the existing minimum-window layout: at a 980 px window, the 150 px workflow rail and the previous 380 px inspector left 450 px for the viewer. Its usable inspector width is clamped against the measured workspace width (`workspace width − 450 px`), then against 330–650 px. Compact mode therefore fits; expanded/custom widths reduce as needed near the window boundary.
- At the 980 px minimum window size, the current 150 px rail leaves an 830 px workspace: a 520 px request is rendered at 380 px, leaving 450 px for the viewport. At a 1100 px window, the 150 px rail leaves 950 px: the 520 px request is rendered at 500 px, again leaving 450 px. At wider sizes, custom mode can reach 650 px while retaining the viewport minimum.
- The separator is keyboard focusable. Left/Right change width by 16 px, Shift+Left/Right by 64 px, and Home/End go to the current minimum/maximum. Pointer dragging and keyboard changes share the same clamp.
- Mode and requested width are stored under `beblog-cam.inspector-layout.v1` in local storage, independently of `.beblogcam` project data. Invalid or unavailable storage falls back to compact mode; custom widths are rounded and clamped when read.
- The existing Werkzeug full-workspace behavior remains: its CSS still hides the 3D viewport and expands the tool calculator to the available window area. The shell controls are hidden in this mode.
- Existing inspector and nested scroll containers are retained. The shell controls stick to the top of the inspector scroll area; existing inspector content keeps its prior ordering.

## State and integration boundary

`InspectorShell.svelte` owns presentation controls only. Its mode and requested width are bound to UI-only variables in `App.svelte`; a `ResizeObserver` measures the workspace so the displayed width follows window changes. CAM setup, operation selection, Advisor context, preflight and NC state remain owned by the existing App/components. The shell preserves the `.inspector` element and descendants so current integrations in `toolpath25dControl.ts`, `dxfNoStockDrillGuard.ts` and the runtime extensions continue to find their existing targets.

The preference write is isolated to the layout control callback and never enters project serialization. Storage errors do not block navigation or the tool workflow.

## Automated acceptance

`pnpm check:011g4b` covers mode dimensions, preference validation and storage failure, resize clamping at workspace boundaries, drag direction, keyboard increments, Svelte compilation, all six step branches, viewport minimum, the Werkzeug full-workspace CSS contract, DOM selector preservation and separation from project persistence.

This repository has no browser component-test harness. Pointer capture, keyboard focus/announcements, actual responsive appearance and retained unsaved form values therefore still require manual UI acceptance after CI. The focused gate exercises the shared resize and preference logic directly and compiles the actual Svelte shell and App.

## Remaining review points

- Verify resizing at the supported minimum window size and at 1100 px / wide desktop sizes in the target WebKit/Tauri shell.
- Confirm the sticky controls do not interfere with dynamically mounted material controls or the tools full-workspace view.
- Confirm screen-reader announcement of the separator's current value in the app's WebKit version.
