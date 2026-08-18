export type ImportKind = 'step' | 'dxf';

export interface Point2 { x: number; y: number; }
export interface Bounds2 { min: Point2; max: Point2; }

export type Curve2 =
  | { kind: 'line'; start: Point2; end: Point2 }
  | { kind: 'circle'; center: Point2; radius: number }
  | { kind: 'arc'; center: Point2; radius: number; startAngleDeg: number; endAngleDeg: number }
  | { kind: 'polyline'; points: Point2[]; closed: boolean }
  | { kind: 'unsupported'; sourceKind: string };

export interface PlanarGeometry {
  curves: Curve2[];
  bounds?: Bounds2;
}

export interface SurfaceTypeSummary { kind: string; count: number; }
export interface BrepSummary {
  backend: string;
  nativeBrep: boolean;
  faces: number;
  edges: number;
  vertices: number;
  solids: number;
  surfaceTypes: SurfaceTypeSummary[];
  cylinderRadiiMm: number[];
  displayTriangles: number;
  displayVertices: number[];
  note: string;
}

export interface ImportSummary {
  kind: ImportKind;
  fileName: string;
  backend: string;
  status: 'ready' | 'native-adapter-pending';
  entities: Record<string, number>;
  planarGeometry?: PlanarGeometry;
  brep?: BrepSummary;
  note?: string;
}

export type StockMode = 'manual' | 'part-bounds' | 'none';
export interface StockDefinition {
  width: number;
  height: number;
  thickness: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export type HorizontalPlacement = 'left' | 'center' | 'right';
export type VerticalPlacement = 'front' | 'center' | 'back';
export interface PartPlacement {
  horizontal: HorizontalPlacement;
  vertical: VerticalPlacement;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

// Part orientation is CAM geometry, not camera orientation. 001E exposes Z
// rotation first; X/Y are already part of the model for future flipped setups.
export interface PartOrientation {
  rotationXDeg: number;
  rotationYDeg: number;
  rotationZDeg: number;
}

export type WcsX = 'left' | 'center' | 'right';
export type WcsY = 'front' | 'center' | 'back';
export type WcsZ = 'top' | 'bottom';
export type WcsReference = 'stock' | 'part';
export interface WorkCoordinateSystem {
  x: WcsX;
  y: WcsY;
  z: WcsZ;
}

export interface SetupDefinition {
  id: string;
  name: string;
  stockMode: StockMode;
  orientation: PartOrientation;
  placement: PartPlacement;
  wcsReference: WcsReference;
  wcs: WorkCoordinateSystem;
}

// 001F starts the CAM-operation layer. Operations remain controller-neutral;
// postprocessors translate them to Estlcam/LinuxCNC compatible G-code later.
export type OperationKind = 'contour';
export type ToolpathSide = 'outside' | 'inside' | 'on-line';
export type CutDirection = 'conventional' | 'climb';

export interface ToolDefinition {
  id: string;
  name: string;
  diameterMm: number;
}

export interface ContourOperation {
  id: string;
  kind: 'contour';
  name: string;
  enabled: boolean;
  contourId: number | null;
  tool: ToolDefinition;
  side: ToolpathSide;
  direction: CutDirection;
  totalDepthMm: number;
  stepDownMm: number;
  feedMmMin: number;
  plungeMmMin: number;
  spindleRpm: number;
  safeZMm: number;
}

export type CamOperation = ContourOperation;

export const defaultStock: StockDefinition = {
  width: 200,
  height: 80,
  thickness: 22,
  offsetX: 10,
  offsetY: 10,
  offsetZ: 0
};

export const defaultPartPlacement: PartPlacement = {
  horizontal: 'center',
  vertical: 'center',
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0
};

export const defaultPartOrientation: PartOrientation = {
  rotationXDeg: 0,
  rotationYDeg: 0,
  rotationZDeg: 0
};

export const defaultWcs: WorkCoordinateSystem = {
  x: 'left',
  y: 'front',
  z: 'top'
};

export const defaultSetup: SetupDefinition = {
  id: 'setup-1',
  name: 'Aufspannung 1',
  stockMode: 'manual',
  orientation: { ...defaultPartOrientation },
  placement: { ...defaultPartPlacement },
  wcsReference: 'stock',
  wcs: { ...defaultWcs }
};

export const defaultContourOperation: ContourOperation = {
  id: 'op-contour-1',
  kind: 'contour',
  name: 'Kontur 1',
  enabled: true,
  contourId: null,
  tool: { id: 'tool-1', name: 'Schaftfräser 3 mm', diameterMm: 3 },
  side: 'outside',
  direction: 'climb',
  totalDepthMm: 3,
  stepDownMm: 1,
  feedMmMin: 600,
  plungeMmMin: 200,
  spindleRpm: 12000,
  safeZMm: 5
};
