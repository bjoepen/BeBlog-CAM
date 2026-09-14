import { generateJobGcode } from '../../src/lib/jobGcode';
import { validateJob } from '../../src/lib/jobPreflight';
import { createCamProjectV1, parseCamProject, serializeCamProject } from '../../src/lib/projectPersistence';
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
  type OperationsProject,
  type PlanarGeometry,
  type StockDefinition,
} from '../../src/lib/types';

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
  fileName: '008b7-reference.dxf',
  backend: '008B7 synthetic fixture',
  status: 'ready',
  entities: { curves: geometry.curves.length },
  planarGeometry: geometry,
  note: 'Deterministic synthetic source reused unchanged before and after project reload.',
};

const stock: StockDefinition = { width: 60, height: 40, thickness: 10, offsetX: 0, offsetY: 0, offsetZ: 0 };
const placement = { ...defaultPartPlacement };
const orientation = { ...defaultPartOrientation };
const wcs = { ...defaultWcs };

const faceTool = {
  ...defaultFacingOperation.tool,
  id: '008b7-face-12',
  name: 'Planfräser 12 mm',
  diameterMm: 12,
  shaftDiameterMm: 12,
};
const millTool = {
  ...defaultPocketOperation.tool,
  id: '008b7-mill-4',
  name: 'Schaftfräser 4 mm',
  diameterMm: 4,
  shaftDiameterMm: 4,
};
const drillTool = {
  ...defaultDrillOperation.tool,
  id: '008b7-drill-6',
  name: 'Bohrer 6 mm',
  diameterMm: 6,
  shaftDiameterMm: 6,
};

const operations: CamOperation[] = [
  { ...defaultFacingOperation, id: '008b7-facing', name: 'Planen 008B7', safeZMm: 5, totalDepthMm: 0.5, tool: faceTool },
  { ...defaultPocketOperation, id: '008b7-pocket', name: 'Tasche 008B7', safeZMm: 5, contourId: 0, contourIds: [0], totalDepthMm: 2, stepDownMm: 1, tool: millTool },
  { ...defaultDrillOperation, id: '008b7-drill', name: 'Bohren 008B7', safeZMm: 5, curveIds: [4, 5], method: 'drill', totalDepthMm: 4, stepDownMm: 4, tool: drillTool },
  { ...defaultContourOperation, id: '008b7-contour', name: 'Kontur 008B7', safeZMm: 5, contourId: 0, contourIds: [0], totalDepthMm: 3, stepDownMm: 1, tool: { ...millTool } },
];

const operationsProject: OperationsProject = { operations, activeOperationId: '008b7-contour' };
const project = createCamProjectV1({
  sourcePath: '/fixtures/008b7-reference.dxf',
  sourceFileName: summary.fileName,
  stock,
  stockMode: 'manual',
  placement,
  orientation,
  wcs,
  fixtures: [],
  machineEnvelopeEnabled: false,
  machineEnvelope: { minX: 0, maxX: 600, minY: 0, maxY: 500, minZ: -80, maxZ: 100, warningMarginMm: 10 },
  machineWcsOrigin: { x: 0, y: 0, z: 0 },
  spindleHeadEnabled: false,
  spindleHead: {
    spindleNoseDiameterMm: 28,
    spindleNoseBottomOffsetMm: 20,
    spindleNoseLengthMm: 55,
    carriageEnabled: false,
    carriageWidthMm: 70,
    carriageDepthMm: 45,
    carriageBottomOffsetMm: 60,
    carriageHeightMm: 120,
  },
  operationsProject,
});
project.source.geometryIdentity = 'src-v1:008b700000000000:fixture';

const runPipeline = (loaded = project) => {
  const args = {
    summary,
    stock: loaded.setup.stock,
    stockMode: loaded.setup.stockMode,
    placement: loaded.setup.placement,
    orientation: loaded.setup.orientation,
    wcs: loaded.setup.wcs,
    operations: loaded.operationsProject.operations,
    fixtures: loaded.setup.fixtures,
    machineEnvelope: loaded.setup.machineEnvelopeEnabled ? loaded.setup.machineEnvelope : null,
    machineWcsOrigin: loaded.setup.machineEnvelopeEnabled ? loaded.setup.machineWcsOrigin : null,
    spindleHead: loaded.setup.spindleHeadEnabled ? loaded.setup.spindleHead : null,
  };
  const preflight = validateJob(args);
  const job = generateJobGcode({ ...args, preflight });
  return { preflight, job };
};

const before = runPipeline(project);
const serialized = serializeCamProject(project);
const loaded = parseCamProject(serialized);
const after = runPipeline(loaded);

export function run008b7() {
  return {
    serializedStable: serializeCamProject(loaded) === serialized,
    operationIdsStable: loaded.operationsProject.operations.map(operation => operation.id).join('|') === project.operationsProject.operations.map(operation => operation.id).join('|'),
    preflightEqual: JSON.stringify(after.preflight) === JSON.stringify(before.preflight),
    ncEqual: after.job.code === before.job.code,
    before: {
      preflightLevel: before.preflight.level,
      preflightErrors: before.preflight.errors,
      enabledCount: before.preflight.enabledCount,
      toolChanges: before.preflight.toolChanges,
      operationLevels: before.preflight.operations.map(operation => ({ id: operation.id, level: operation.level, canonical: operation.canonical })),
      jobOk: before.job.ok,
      jobErrors: before.job.errors,
      lineCount: before.job.lineCount,
      operationCount: before.job.operationCount,
      toolChangeCount: before.job.toolChangeCount,
      code: before.job.code,
    },
    after: {
      preflightLevel: after.preflight.level,
      preflightErrors: after.preflight.errors,
      enabledCount: after.preflight.enabledCount,
      toolChanges: after.preflight.toolChanges,
      operationLevels: after.preflight.operations.map(operation => ({ id: operation.id, level: operation.level, canonical: operation.canonical })),
      jobOk: after.job.ok,
      jobErrors: after.job.errors,
      lineCount: after.job.lineCount,
      operationCount: after.job.operationCount,
      toolChangeCount: after.job.toolChangeCount,
      code: after.job.code,
    },
  };
}

console.log(JSON.stringify(run008b7()));