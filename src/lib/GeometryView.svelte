<script lang="ts">
  import type { Curve2, ImportSummary, Point2 } from './types';

  export let summary: ImportSummary;

  type Projected = { x: number; y: number };
  const width = 1000;
  const height = 650;
  const pad = 54;

  function fit(points: Projected[]): (point: Projected) => Projected {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1e-9);
    const spanY = Math.max(maxY - minY, 1e-9);
    const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
    const usedW = spanX * scale, usedH = spanY * scale;
    const ox = (width - usedW) / 2, oy = (height - usedH) / 2;
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
      while (end < start) end += 360;
      return Array.from({ length: 33 }, (_, i) => {
        const a = (start + ((end - start) * i) / 32) * Math.PI / 180;
        return { x: curve.center.x + Math.cos(a) * curve.radius, y: curve.center.y + Math.sin(a) * curve.radius };
      });
    }
    return [];
  }

  function planarPath(): string {
    const curves = summary.planarGeometry?.curves ?? [];
    const samples = curves.map(sampleCurve);
    const all = samples.flat();
    if (!all.length) return '';
    const map = fit(all);
    return samples.map((points, i) => {
      if (!points.length) return '';
      const projected = points.map(map);
      const curve = curves[i];
      const commands = projected.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
      const closed = curve.kind === 'circle' || (curve.kind === 'polyline' && curve.closed);
      return commands + (closed ? ' Z' : '');
    }).join(' ');
  }

  function meshPath(): string {
    const values = summary.brep?.displayVertices ?? [];
    if (values.length < 9) return '';
    const projected: Projected[] = [];
    for (let i = 0; i + 2 < values.length; i += 3) {
      const x = values[i], y = values[i + 1], z = values[i + 2];
      projected.push({ x: x - y * 0.62, y: z + (x + y) * 0.26 });
    }
    const map = fit(projected);
    const fitted = projected.map(map);
    let path = '';
    for (let i = 0; i + 2 < fitted.length; i += 3) {
      const a = fitted[i], b = fitted[i + 1], c = fitted[i + 2];
      path += `M${a.x.toFixed(2)},${a.y.toFixed(2)} L${b.x.toFixed(2)},${b.y.toFixed(2)} L${c.x.toFixed(2)},${c.y.toFixed(2)} Z `;
    }
    return path;
  }

  $: dxfPath = planarPath();
  $: stepPath = meshPath();
</script>

<div class="geometry-view">
  <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${summary.kind.toUpperCase()} Geometrievorschau`}>
    <rect x="22" y="22" width={width - 44} height={height - 44} rx="24" class="stock-frame" />
    {#if summary.kind === 'dxf' && dxfPath}
      <path d={dxfPath} class="dxf-geometry" />
    {:else if summary.kind === 'step' && stepPath}
      <path d={stepPath} class="step-geometry" />
    {:else}
      <text x="500" y="325" text-anchor="middle" class="waiting">Geometrie wird vom nativen Backend bereitgestellt.</text>
    {/if}
  </svg>
  <div class="geometry-caption">
    <strong>{summary.kind === 'step' ? 'BRep · Display-Mesh' : 'Planare BeBlog-Geometrie'}</strong>
    <span>{summary.kind === 'step' && summary.brep ? `${summary.brep.displayTriangles} Dreiecke · nur Darstellung` : `${summary.planarGeometry?.curves.length ?? 0} Kurven`}</span>
  </div>
</div>

<style>
  .geometry-view { width: min(92%, 1100px); margin: auto; }
  svg { width: 100%; display: block; }
  .stock-frame { fill: rgba(255,255,255,.18); stroke: rgba(60,66,63,.16); stroke-width: 2; }
  .dxf-geometry { fill: none; stroke: #26342e; stroke-width: 2.4; vector-effect: non-scaling-stroke; }
  .step-geometry { fill: rgba(72,94,84,.18); stroke: rgba(38,52,46,.48); stroke-width: .75; vector-effect: non-scaling-stroke; }
  .waiting { fill: #737b77; font-size: 24px; }
  .geometry-caption { display: flex; justify-content: space-between; gap: 24px; padding: 0 5% 12px; color: #65706b; font-size: 12px; }
  .geometry-caption strong { color: #34423c; font-weight: 600; }
</style>
