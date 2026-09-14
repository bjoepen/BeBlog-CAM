import { generateJobGcode } from '../../src/lib/jobGcode';
import {
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

const geometry: PlanarGeometry = {
  curves: [
    line(10, 10, 50, 10),
    line(50, 10, 50, 30),
    line(50, 30, 10, 30),
    line(10, 30, 10, 10),
    circle(20, 20, 3),
    circle(40, 20, 3),
  ],
  curveLayers: ['CUT', 'CUT', 'CUT', 'CUT', 'DRILL', 'DRILL'],
  layerNames: ['CUT', 'DRILL'],
  bounds: { min: point(10, 10), max: point(50, 30) },
};

const summary: ImportSummary = {
  kind: 'dxf',
  fileName: 'synthetic-multi-operation.dxf',
  backend: '008A4 synthetic fixture',
  status: 'ready',
  entities: { curves: geometry.curves.length },
  planarGeometry: geometry,
  note: 'Generated in code; one deterministic planar fixture drives a combined production job.',
};

const faceTool = {
  ...defaultFacingOperation.tool,
  id: 'a4-face-12',
  name: 'Planfräser 12 mm',
  diameterMm: 12,
  shaftDiameterMm: 12,
};

const millTool = {
  ...defaultPocketOperation.tool,
  id: 'a4-mill-4',
  name: 'Schaftfräser 4 mm',
  diameterMm: 4,
  shaftDiameterMm: 4,
};

const drillTool = {
  ...defaultDrillOperation.tool,
  id: 'a4-drill-6',
  name: 'Bohrer 6 mm',
  diameterMm: 6,
  shaftDiameterMm: 6,
};

const operations: CamOperation[] = [
  {
    ...defaultFacingOperation,
    id: 'a4-facing',
    name: 'Planen A4',
    safeZMm: 5,
    totalDepthMm: 0.5,
    tool: faceTool,
  },
  {
    ...defaultPocketOperation,
    id: 'a4-pocket',
    name: 'Tasche A4',
    safeZMm: 5,
    contourId: 0,
    contourIds: [0],
    totalDepthMm: 2,
    stepDownMm: 1,
    tool: millTool,
  },
  {
    ...defaultDrillOperation,
    id: 'a4-drill',
    name: 'Bohren A4',
    safeZMm: 5,
    curveIds: [4, 5],
    method: 'drill',
    totalDepthMm: 4,
    stepDownMm: 4,
    tool: drillTool,
  },
  {
    ...defaultContourOperation,
    id: 'a4-contour',
    name: 'Kontur A4',
    safeZMm: 5,
    contourId: 0,
    contourIds: [0],
    totalDepthMm: 3,
    stepDownMm: 1,
    tool: { ...millTool },
  },
];

const job = generateJobGcode({
  summary,
  stock,
  stockMode: 'manual',
  placement,
  orientation,
  wcs,
  operations,
});

console.log(JSON.stringify({
  operationIds: operations.map((operation) => operation.id),
  safeZMm: 5,
  expectedToolChanges: 3,
  job: {
    ok: job.ok,
    errors: job.errors,
    warnings: job.warnings,
    code: job.code,
    lineCount: job.lineCount,
    operationCount: job.operationCount,
    toolChangeCount: job.toolChangeCount,
  },
}));
