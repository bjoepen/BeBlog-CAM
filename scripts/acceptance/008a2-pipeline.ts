import { generateJobGcode } from '../../src/lib/jobGcode';
import { postProcessEstlcam } from '../../src/lib/postprocessors';
import {
  defaultCarveOperation,
  defaultContourOperation,
  defaultDrillOperation,
  defaultFacingOperation,
  defaultPartOrientation,
  defaultPartPlacement,
  defaultPocketOperation,
  defaultWcs,
  type CamOperation,
  type ImportSummary,
  type PlanarGeometry,
  type StockDefinition,
} from '../../src/lib/types';

const stock: StockDefinition = { width: 60, height: 40, thickness: 10, offsetX: 0, offsetY: 0, offsetZ: 0 };
const placement = { ...defaultPartPlacement };
const orientation = { ...defaultPartOrientation };
const wcs = { ...defaultWcs };

const point = (x: number, y: number) => ({ x, y });
const line = (x1: number, y1: number, x2: number, y2: number) => ({ kind: 'line' as const, start: point(x1, y1), end: point(x2, y2) });
const circle = (x: number, y: number, radius: number) => ({ kind: 'circle' as const, center: point(x, y), radius });

const rectangle = (): PlanarGeometry => ({
  curves: [line(10, 10, 50, 10), line(50, 10, 50, 30), line(50, 30, 10, 30), line(10, 30, 10, 10)],
  curveLayers: ['CUT', 'CUT', 'CUT', 'CUT'],
  layerNames: ['CUT'],
  bounds: { min: point(10, 10), max: point(50, 30) },
});

const drillPattern = (): PlanarGeometry => ({
  curves: [circle(20, 20, 3), circle(40, 20, 3)],
  curveLayers: ['DRILL', 'DRILL'],
  layerNames: ['DRILL'],
  bounds: { min: point(17, 17), max: point(43, 23) },
});

const summary = (geometry: PlanarGeometry, fileName: string): ImportSummary => ({
  kind: 'dxf',
  fileName,
  backend: '008A2 synthetic fixture',
  status: 'ready',
  entities: { curves: geometry.curves.length },
  planarGeometry: geometry,
  note: 'Generated in code; no external DXF fixture required.',
});

const fixtures: Array<{ name: string; summary: ImportSummary; operation: CamOperation }> = [
  {
    name: 'facing',
    summary: summary(rectangle(), 'synthetic-facing.dxf'),
    operation: { ...defaultFacingOperation, id: 'a2-facing', name: 'Planen A2', tool: { ...defaultFacingOperation.tool } },
  },
  {
    name: 'contour',
    summary: summary(rectangle(), 'synthetic-contour.dxf'),
    operation: { ...defaultContourOperation, id: 'a2-contour', name: 'Kontur A2', contourId: 0, contourIds: [0], tool: { ...defaultContourOperation.tool } },
  },
  {
    name: 'pocket',
    summary: summary(rectangle(), 'synthetic-pocket.dxf'),
    operation: { ...defaultPocketOperation, id: 'a2-pocket', name: 'Tasche A2', contourId: 0, contourIds: [0], totalDepthMm: 2, stepDownMm: 1, tool: { ...defaultPocketOperation.tool } },
  },
  {
    name: 'carve',
    summary: summary({ curves: [line(10, 20, 50, 20)], curveLayers: ['CARVE'], layerNames: ['CARVE'], bounds: { min: point(10, 20), max: point(50, 20) } }, 'synthetic-carve.dxf'),
    operation: { ...defaultCarveOperation, id: 'a2-carve', name: 'Carve A2', curveIds: [0], tool: { ...defaultCarveOperation.tool } },
  },
  {
    name: 'drill',
    summary: summary(drillPattern(), 'synthetic-drill.dxf'),
    operation: { ...defaultDrillOperation, id: 'a2-drill', name: 'Bohren A2', curveIds: [0, 1], method: 'drill', totalDepthMm: 4, tool: { ...defaultDrillOperation.tool } },
  },
  {
    name: 'helix',
    summary: summary(drillPattern(), 'synthetic-helix.dxf'),
    operation: { ...defaultDrillOperation, id: 'a2-helix', name: 'Bohren A2 Helix', curveIds: [0, 1], method: 'helical-mill', totalDepthMm: 4, stepDownMm: 1, tool: { ...defaultDrillOperation.tool } },
  },
];

const results = fixtures.map(({ name, summary, operation }) => {
  const job = generateJobGcode({ summary, stock, stockMode: 'manual', placement, orientation, wcs, operations: [operation] });
  const posted = job.ok ? postProcessEstlcam(job.code) : { ok: false, errors: ['raw job failed'], warnings: [], code: '' };
  return {
    name,
    safeZMm: operation.safeZMm,
    job: { ok: job.ok, errors: job.errors, warnings: job.warnings, code: job.code, lineCount: job.lineCount, operationCount: job.operationCount, toolChangeCount: job.toolChangeCount },
    estlcam: { ok: posted.ok, errors: posted.errors, warnings: posted.warnings, code: posted.code },
  };
});

process.stdout.write(JSON.stringify(results));
