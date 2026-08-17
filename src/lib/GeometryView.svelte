<script lang="ts">
  import { onMount } from 'svelte';
  import type { Curve2, ImportSummary, Point2 } from './types';

  export let summary: ImportSummary;

  type Projected = { x: number; y: number };
  type ViewState = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };

  const width = 1000;
  const height = 650;
  const pad = 54;

  let viewport: SVGSVGElement;
  let yaw = -0.72;
  let pitch = 0.48;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragMode: 'orbit' | 'pan' = 'orbit';
  let lastX = 0;
  let lastY = 0;
  let stepPath = '';

  function isFinitePoint(point: Projected): boolean {
    return Number.isFinite(point.x) && Number.isFinite(point.y);
  }

  function fit(points: Projected[], viewZoom = 1, viewPanX = 0, viewPanY = 0): (point: Projected) => Projected {
    const finite = points.filter(isFinitePoint);
    if (!finite.length) return (point) => point;
    const xs = finite.map((p) => p.x);
    const ys = finite.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1e-9);
    const spanY = Math.max(maxY - minY, 1e-9);
    const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY) * viewZoom;
    const usedW = spanX * scale, usedH = spanY * scale;
    const ox = (width - usedW) / 2 + viewPanX;
    const oy = (height - usedH) / 2 + viewPanY;
    return (point) => ({ x: ox + (point.x - minX) * scale, y: height - (oy + (point.y - minY) * scale) });
  }

  function sampleCurve(curve: Curve2): Point2[] {
    if (curve.kind === 'line') return [curve.start, curve.end];
    if (curve.kind === 'polyline') return curve.points;
    if (curve.kind === 'circle') {
      return Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64) * Math.PI * 2;
        return { x: curve.center.x + Math.cos(a) * curve.radius, y: curve.center.y + Math.sin(a) * curve.radius };
      });
    }
    if (curve.kind === 'arc') {
      let start = curve.startAngleDeg;
      let end = curve.endAngleDeg;
      if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(curve.radius)) return [];
      while (end < start) end += 360;
      return Array.from({ length: 33 }, (_, i) => {
        const a = (start + ((end - start) * i) / 32) * Math.PI / 180;
        return { x: curve.center.x + Math.cos(a) * curve.radius, y: curve.center.y + Math.sin(a) * curve.radius };
      });
    }
    return [];
  }

  function planarPaths(): string[] {
    const curves = summary.planarGeometry?.curves ?? [];
    const sampled = curves.map((curve) => sampleCurve(curve).filter(isFinitePoint));
    const all = sampled.flat();
    if (!all.length) return [];
    const map = fit(all);
    return sampled.map((points, i) => {
      if (!points.length) return '';
      const projected = points.map(map).filter(isFinitePoint);
      if (!projected.length) return '';
      const curve = curves[i];
      const commands = projected.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      const closed = curve.kind === 'circle' || (curve.kind === 'polyline' && curve.closed);
      return commands + (closed ? ' Z' : '');
    }).filter(Boolean);
  }

  function project3d(x: number, y: number, z: number, view: ViewState): Projected {
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
    const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const x1 = x * cy - y * sy;
    const y1 = x * sy + y * cy;
    const y2 = y1 * cp - z * sp;
    const z2 = y1 * sp + z * cp;
    return { x: x1, y: z2 + y2 * 0.08 };
  }

  function meshPath(source: ImportSummary, view: ViewState): string {
    const values = source.brep?.displayVertices ?? [];
    if (source.kind !== 'step' || values.length < 9) return '';

    const projected: Projected[] = [];
    for (let i = 0; i + 2 < values.length; i += 3) {
      projected.push(project3d(values[i], values[i + 1], values[i + 2], view));
    }

    const map = fit(projected, view.zoom, view.panX, view.panY);
    const fitted = projected.map(map).filter(isFinitePoint);
    let path = '';
    for (let i = 0; i + 2 < fitted.length; i += 3) {
      const a = fitted[i], b = fitted[i + 1], c = fitted[i + 2];
      path += `M${a.x.toFixed(2)},${a.y.toFixed(2)} L${b.x.toFixed(2)},${b.y.toFixed(2)} L${c.x.toFixed(2)},${c.y.toFixed(2)} Z `;
    }
    return path;
  }

  function pointerDown(event: PointerEvent) {
    if (summary.kind !== 'step') return;
    dragging = true;
    dragMode = event.shiftKey || event.button === 1 || event.button === 2 ? 'pan' : 'orbit';
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent) {
    if (!dragging || summary.kind !== 'step') return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (dragMode === 'orbit') {
      yaw += dx * 0.008;
      pitch = Math.max(-1.5, Math.min(1.5, pitch - dy * 0.008));
    } else {
      panX += dx;
      panY -= dy;
    }
  }

  function pointerUp(event: PointerEvent) {
    dragging = false;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  }

  function wheel(event: WheelEvent) {
    if (summary.kind !== 'step') return;
    event.preventDefault();
    zoom = Math.max(0.35, Math.min(4, zoom * Math.exp(-event.deltaY * 0.0012)));
  }

  function contextMenu(event: MouseEvent) {
    if (summary.kind === 'step') event.preventDefault();
  }

  function resetView() {
    yaw = -0.72;
    pitch = 0.48;
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  onMount(() => {
    const el = viewport;
    el.addEventListener('pointerdown', pointerDown);
    el.addEventListener('pointermove', pointerMove);
    el.addEventListener('pointerup', pointerUp);
    el.addEventListener('pointercancel', pointerUp);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('contextmenu', contextMenu);

    return () => {
      el.removeEventListener('pointerdown', pointerDown);
      el.removeEventListener('pointermove', pointerMove);
      el.removeEventListener('pointerup', pointerUp);
      el.removeEventListener('pointercancel', pointerUp);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('contextmenu', contextMenu);
    };
  });

  $: dxfPaths = planarPaths();
  $: stepPath = meshPath(summary, { yaw, pitch, zoom, panX, panY });
</script>

<div class="geometry-view">
  <svg
    bind:this={viewport}
    viewBox={`0 0 ${width} ${height}`}
    role="img"
    aria-label={`${summary.kind.toUpperCase()} Geometrievorschau`}
    class:interactive={summary.kind === 'step'}
  >
    <rect x="22" y="22" width={width - 44} height={height - 44} rx="24" class="stock-frame" />
    {#if summary.kind === 'dxf' && dxfPaths.length}
      {#each dxfPaths as pathData}
        <path d={pathData} class="dxf-geometry" />
      {/each}
    {:else if summary.kind === 'step' && stepPath}
      <path d={stepPath} class="step-geometry" />
    {:else}
      <text x="500" y="325" text-anchor="middle" class="waiting">Geometrie wird vom nativen Backend bereitgestellt.</text>
    {/if}
  </svg>
  <div class="geometry-caption">
    <strong>{summary.kind === 'step' ? 'BRep · Display-Mesh' : '2D-Geometrie'}</strong>
    {#if summary.kind === 'step'}
      <span class="view-help">Ziehen: Orbit · ⇧ Ziehen/Rechtsklick: Pan · Scrollen: Zoom · <button onclick={resetView}>Ansicht zurücksetzen</button></span>
    {:else}
      <span>{summary.planarGeometry?.curves.length ?? 0} Konturelemente</span>
    {/if}
  </div>
</div>

<style>
  .geometry-view { width: min(92%, 1100px); margin: auto; }
  svg { width: 100%; display: block; touch-action: none; user-select: none; }
  svg.interactive { cursor: grab; }
  svg.interactive:active { cursor: grabbing; }
  .stock-frame { fill: rgba(255,255,255,.18); stroke: rgba(60,66,63,.16); stroke-width: 2; }
  .dxf-geometry { fill: none; stroke: #26342e; stroke-width: 2.4; vector-effect: non-scaling-stroke; stroke-linecap: round; stroke-linejoin: round; }
  .step-geometry { fill: rgba(72,94,84,.18); stroke: rgba(38,52,46,.48); stroke-width: .75; vector-effect: non-scaling-stroke; pointer-events: none; }
  .waiting { fill: #737b77; font-size: 24px; pointer-events: none; }
  .geometry-caption { display: flex; justify-content: space-between; gap: 24px; padding: 0 5% 12px; color: #65706b; font-size: 12px; align-items: center; }
  .geometry-caption strong { color: #34423c; font-weight: 600; }
  .view-help { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .view-help button { border: 0; background: transparent; padding: 0; color: #34423c; text-decoration: underline; cursor: pointer; font: inherit; }
</style>
