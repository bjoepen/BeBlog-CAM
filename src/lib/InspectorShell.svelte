<script lang="ts">
  import {
    INSPECTOR_COMPACT_WIDTH,
    INSPECTOR_EXPANDED_WIDTH,
    INSPECTOR_MAX_WIDTH,
    INSPECTOR_MIN_WIDTH,
    VIEWPORT_MIN_WIDTH,
    clampInspectorWidth,
    inspectorWidthFromDrag,
    keyboardInspectorResizeDelta,
    resizeInspectorWidth,
    type InspectorMode,
    type InspectorLayoutPreference,
  } from './inspectorLayout';

  export let mode: InspectorMode = 'compact';
  export let width = INSPECTOR_COMPACT_WIDTH;
  export let workspaceWidth = 0;
  export let onLayoutChange: ((preference: InspectorLayoutPreference) => void) | undefined = undefined;

  let dragStartX = 0;
  let dragStartWidth = 0;
  let dragging = false;

  $: effectiveWidth = clampInspectorWidth(width, workspaceWidth || INSPECTOR_MAX_WIDTH + VIEWPORT_MIN_WIDTH);

  function chooseMode(nextMode: 'compact' | 'expanded') {
    mode = nextMode;
    width = nextMode === 'compact' ? INSPECTOR_COMPACT_WIDTH : INSPECTOR_EXPANDED_WIDTH;
    onLayoutChange?.({ mode, width });
  }

  function startResize(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    dragStartX = event.clientX;
    dragStartWidth = effectiveWidth;
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function moveResize(event: PointerEvent) {
    if (!dragging) return;
    width = inspectorWidthFromDrag(dragStartWidth, dragStartX, event.clientX, workspaceWidth || INSPECTOR_MAX_WIDTH + VIEWPORT_MIN_WIDTH);
    mode = 'custom';
  }

  function stopResize() {
    if (dragging) onLayoutChange?.({ mode, width });
    dragging = false;
  }

  function keyResize(event: KeyboardEvent) {
    const delta = keyboardInspectorResizeDelta(event.key, event.shiftKey);
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      width = event.key === 'Home' ? INSPECTOR_MIN_WIDTH : clampInspectorWidth(INSPECTOR_MAX_WIDTH, workspaceWidth || INSPECTOR_MAX_WIDTH + VIEWPORT_MIN_WIDTH);
      mode = 'custom';
      onLayoutChange?.({ mode, width });
      return;
    }
    if (delta === null) return;
    event.preventDefault();
    width = resizeInspectorWidth(effectiveWidth, delta, workspaceWidth || INSPECTOR_MAX_WIDTH + VIEWPORT_MIN_WIDTH);
    mode = 'custom';
    onLayoutChange?.({ mode, width });
  }
</script>

<aside class="inspector" aria-label="Schritt-Inspector">
  <div class="inspector-layout-controls">
    <div class="inspector-mode" role="group" aria-label="Inspector-Breite">
      <button type="button" class:active={mode === 'compact'} aria-pressed={mode === 'compact'} onclick={() => chooseMode('compact')}>Kompakt</button>
      <button type="button" class:active={mode === 'expanded'} aria-pressed={mode === 'expanded'} onclick={() => chooseMode('expanded')}>Erweitert</button>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
    <div
      class="inspector-resize"
      role="separator"
      aria-label="Breite des Inspectors ändern"
      aria-orientation="vertical"
      aria-valuemin={INSPECTOR_MIN_WIDTH}
      aria-valuemax={Math.max(INSPECTOR_MIN_WIDTH, Math.min(INSPECTOR_MAX_WIDTH, workspaceWidth - VIEWPORT_MIN_WIDTH))}
      aria-valuenow={effectiveWidth}
      aria-valuetext={`${effectiveWidth} Pixel`}
      tabindex="0"
      onpointerdown={startResize}
      onpointermove={moveResize}
      onpointerup={stopResize}
      onpointercancel={stopResize}
      onkeydown={keyResize}
      title="Ziehen oder mit den Pfeiltasten ändern"
    >
      <span aria-hidden="true"></span>
    </div>
    <span class="inspector-width" aria-hidden="true">{effectiveWidth} px</span>
  </div>
  <slot />
</aside>

<style>
  .inspector-layout-controls {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: -28px -24px 18px;
    padding: 10px 24px;
    border-bottom: 1px solid #e1e1dc;
    background: #faf9f6;
  }
  .inspector-mode { display: flex; gap: 5px; }
  .inspector-mode button {
    border: 1px solid #d5d7d2;
    border-radius: 6px;
    padding: 6px 9px;
    background: #fff;
    color: #5f6662;
    cursor: pointer;
    font-size: .72rem;
  }
  .inspector-mode button.active { border-color: #59675f; background: #e9ece8; color: #27322c; }
  .inspector-resize {
    display: grid;
    place-items: center;
    width: 28px;
    min-width: 28px;
    height: 30px;
    border-radius: 5px;
    cursor: col-resize;
    touch-action: none;
  }
  .inspector-resize span { width: 3px; height: 16px; border-right: 1px solid #8b938d; border-left: 1px solid #8b938d; }
  .inspector-resize:hover, .inspector-resize:focus-visible { outline: 2px solid #59675f; outline-offset: 1px; }
  .inspector-width { margin-left: auto; color: #747a76; font-size: .7rem; font-variant-numeric: tabular-nums; }
  :global(.workspace:has(.tools-page) > .inspector .inspector-layout-controls) { display: none; }
</style>
