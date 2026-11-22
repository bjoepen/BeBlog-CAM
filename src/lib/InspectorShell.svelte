<script lang="ts">
  import {
    INSPECTOR_DEFAULT_WIDTH,
    INSPECTOR_MAX_WIDTH,
    INSPECTOR_MIN_WIDTH,
    VIEWPORT_MIN_WIDTH,
    clampInspectorWidth,
    inspectorWidthFromDrag,
    keyboardInspectorResizeDelta,
    resizeInspectorWidth,
    type InspectorLayoutPreference,
  } from './inspectorLayout';

  export let width = INSPECTOR_DEFAULT_WIDTH;
  export let workspaceWidth = 0;
  export let onWidthCommit: ((preference: InspectorLayoutPreference) => void) | undefined = undefined;

  let dragStartX = 0;
  let dragStartWidth = 0;
  let dragPointerId: number | null = null;
  let dragging = false;

  $: effectiveWidth = clampInspectorWidth(width, workspaceWidth || INSPECTOR_MAX_WIDTH + VIEWPORT_MIN_WIDTH);
  $: availableMaxWidth = Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, workspaceWidth - VIEWPORT_MIN_WIDTH));

  function commitWidth() {
    onWidthCommit?.({ width });
  }

  function startResize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      return;
    }
    dragStartX = event.clientX;
    dragStartWidth = effectiveWidth;
    dragPointerId = event.pointerId;
    dragging = true;
  }

  function moveResize(event: PointerEvent) {
    if (!dragging || event.pointerId !== dragPointerId) return;
    // `width` is bound to App state; every pointer move therefore updates the
    // workspace CSS custom property immediately while capture keeps the drag alive.
    width = inspectorWidthFromDrag(dragStartWidth, dragStartX, event.clientX, workspaceWidth || INSPECTOR_MAX_WIDTH + VIEWPORT_MIN_WIDTH);
  }

  function finishResize(event?: PointerEvent) {
    if (!dragging || (event && event.pointerId !== dragPointerId)) return;
    dragging = false;
    dragPointerId = null;
    commitWidth();
  }

  function resetWidth() {
    width = INSPECTOR_DEFAULT_WIDTH;
    commitWidth();
  }

  function keyResize(event: KeyboardEvent) {
    const delta = keyboardInspectorResizeDelta(event.key, event.shiftKey);
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      width = event.key === 'Home'
        ? INSPECTOR_MIN_WIDTH
        : clampInspectorWidth(INSPECTOR_MAX_WIDTH, workspaceWidth || INSPECTOR_MAX_WIDTH + VIEWPORT_MIN_WIDTH);
      commitWidth();
      return;
    }
    if (delta === null) return;
    event.preventDefault();
    width = resizeInspectorWidth(effectiveWidth, delta, workspaceWidth || INSPECTOR_MAX_WIDTH + VIEWPORT_MIN_WIDTH);
    commitWidth();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
<div
  class="inspector-divider"
  role="separator"
  aria-label="Breite des Inspectors ändern"
  aria-orientation="vertical"
  aria-valuemin={INSPECTOR_MIN_WIDTH}
  aria-valuemax={availableMaxWidth}
  aria-valuenow={effectiveWidth}
  aria-valuetext={`${effectiveWidth} Pixel`}
  tabindex="0"
  onpointerdown={startResize}
  onpointermove={moveResize}
  onpointerup={finishResize}
  onpointercancel={finishResize}
  onlostpointercapture={finishResize}
  ondblclick={resetWidth}
  onkeydown={keyResize}
  title="Ziehen zum Ändern · Doppelklick setzt die Standardbreite"
>
  <span aria-hidden="true"></span>
</div>

<aside class="inspector" aria-label="Schritt-Inspector">
  <slot />
</aside>

<style>
  .inspector-divider {
    position: absolute;
    left: calc(100% - var(--inspector-width, 330px));
    top: 50%;
    z-index: 25;
    display: grid;
    place-items: center;
    width: 36px;
    height: 72px;
    margin: 0;
    padding: 0;
    transform: translate(-50%, -50%);
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    cursor: col-resize;
    touch-action: none;
  }
  .inspector-divider span {
    width: 4px;
    height: 38px;
    border-radius: 4px;
    background: #8a958e;
    box-shadow: 0 0 0 1px #faf9f6;
    transition: width 100ms ease, background-color 100ms ease;
  }
  .inspector-divider:hover span,
  .inspector-divider:focus-visible span,
  .inspector-divider:active span {
    width: 6px;
    background: #34453b;
  }
  .inspector-divider:focus-visible {
    outline: 2px solid #59675f;
    outline-offset: 1px;
  }
</style>
