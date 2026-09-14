import {
  createCamProjectV1,
  parseCamProject,
  serializeCamProject,
} from '../../src/lib/projectPersistence';
import {
  defaultContourOperation,
  defaultDrillOperation,
  defaultPartOrientation,
  defaultPartPlacement,
  defaultStock,
  defaultWcs,
  type OperationsProject,
} from '../../src/lib/types';

const operationsProject: OperationsProject = {
  operations: [
    {
      ...defaultContourOperation,
      id: '008b1-contour',
      name: 'Kontur 008B1',
      contourId: 0,
      contourIds: [0],
      tool: {
        ...defaultContourOperation.tool,
        id: '008b1-mill-4',
        name: 'Schaftfräser 4 mm',
        diameterMm: 4,
        shaftDiameterMm: 4,
      },
    },
    {
      ...defaultDrillOperation,
      id: '008b1-drill',
      name: 'Bohren 008B1',
      curveIds: [4, 5],
      tool: {
        ...defaultDrillOperation.tool,
        id: '008b1-drill-6',
        name: 'Bohrer 6 mm',
        diameterMm: 6,
        shaftDiameterMm: 6,
      },
    },
  ],
  activeOperationId: '008b1-drill',
};

const project = createCamProjectV1({
  sourcePath: '/fixtures/008b1-reference.dxf',
  sourceFileName: '008b1-reference.dxf',
  stock: { ...defaultStock, width: 120, height: 70, thickness: 18, offsetX: 2, offsetY: 3 },
  stockMode: 'manual',
  placement: { ...defaultPartPlacement, horizontal: 'left', vertical: 'front', offsetX: 2, offsetY: 3, offsetZ: 1 },
  orientation: { ...defaultPartOrientation, rotationZDeg: 90 },
  wcs: { ...defaultWcs, x: 'center' },
  fixtures: [
    { id: 'fixture-008b1', name: 'Spannpratze 008B1', enabled: true, minX: 2, maxX: 12, minY: 55, maxY: 65, bottomZ: 0, topZ: 8 },
  ],
  machineEnvelopeEnabled: true,
  machineEnvelope: { minX: 0, maxX: 600, minY: 0, maxY: 500, minZ: -80, maxZ: 100, warningMarginMm: 10 },
  machineWcsOrigin: { x: 40, y: 30, z: 15 },
  spindleHeadEnabled: true,
  spindleHead: {
    spindleNoseDiameterMm: 28,
    spindleNoseBottomOffsetMm: 20,
    spindleNoseLengthMm: 55,
    carriageEnabled: true,
    carriageWidthMm: 70,
    carriageDepthMm: 45,
    carriageBottomOffsetMm: 60,
    carriageHeightMm: 120,
  },
  operationsProject,
});

const serialized = serializeCamProject(project);
const loaded = parseCamProject(serialized);
const reserialized = serializeCamProject(loaded);
const loadedSnapshot = JSON.parse(JSON.stringify(loaded));
const originalBeforeMutation = serializeCamProject(project);

loaded.setup.stock.width = 999;
loaded.setup.fixtures[0].name = 'mutated fixture';
loaded.operationsProject.operations[0].tool.name = 'mutated tool';

export function run008b1() {
  return {
    serialized,
    reserialized,
    project,
    loadedSnapshot,
    originalBeforeMutation,
    originalAfterLoadedMutation: serializeCamProject(project),
  };
}

console.log(JSON.stringify(run008b1()));
