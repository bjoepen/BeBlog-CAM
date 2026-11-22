# Development 011-G4-B2 – Inspector Divider Resize

## Issue

Manual QA on the initial 011-G4-B implementation failed. The sticky mode/resize bar covered the inspector's original top content, consumed space, and did not provide an intuitive resize affordance. In particular, the inspector's scroll and sticky positioning made the bar unsuitable as a persistent resize control.

## Correction

- Removed the compact/expanded buttons, sticky bar and permanent width label.
- Added one accessible resize separator as a sibling of `.inspector`, absolutely positioned at the viewport/inspector boundary and vertically centered. It does not add a CSS grid track and remains outside the inspector scroll container.
- The full 36 × 72 px hit target shows a narrow grip; hover, focus and active states make it clearer. Its pointer cursor is horizontal-resize.
- Each captured pointer move calculates an absolute width from drag start and assigns the bound `width` immediately. `App.svelte` clamps that request against measured workspace width and publishes it into `--inspector-width`, maintaining the 450 px viewport minimum. Dragging left grows the inspector; dragging right shrinks it.
- Pointer capture is established before a drag starts. Pointer-up, pointer-cancel and lost-capture all clear the active drag and persist the last width. Capture setup failure leaves the interaction inactive.
- Dblclick resets to 330 px. Keyboard operation remains independent: arrows 16 px, Shift+arrows 64 px, Home minimum, End maximum available. ARIA value reflects the displayed, viewport-clamped width.
- `App.svelte` remains the owner of the layout preference. The existing `beblog-cam.inspector-layout.v1` key is retained. New writes store only `{ width }`; old `{ mode, width }` preferences remain readable and are normalized to the 330–650 px range. No CAM project data is migrated or changed.
- The Werkzeug full-workspace view hides the divider. `.inspector` and existing descendant selectors remain unchanged.

## Automated verification

`check:011g4b` now checks the no-button/no-sticky-bar UI, sibling placement outside the inspector, absolute centered positioning, direct pointer-move-to-App binding, pointer capture/cancel/lost-capture handling, dblclick reset, keyboard and ARIA contract, viewport clamping, legacy preference compatibility, Werkzeug full-page behavior, and existing DOM integrations.

The repository has no installed browser/component interaction harness. These tests exercise the production width calculation and verify event/binding integration, but they do not simulate a native WebKit pointer stream. The failed manual observation is not considered passed by source assertions; the native manual acceptance below is still required.

## QA status and remaining acceptance

The following commands were run locally and passed:

- `pnpm check:011g4b`
- `pnpm check`
- `pnpm build`
- `pnpm check:011f6`
- `pnpm check:011g3`
- `pnpm check:004w`
- `git diff --check`

`pnpm check` reports 0 errors and the existing 30 warnings in three files. `pnpm build` reports the existing large-chunk advisory.

CI and native `pnpm native:dev` acceptance remain pending. The manual checks must verify immediate drag feedback, the centered grip, no top-content overlap, scrolling, resize bounds, all six worksteps, and the unchanged Werkzeug full-workspace view before the PR is reconsidered for merge.
