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

// One project may later contain multiple setups. The UI still presents a
// single simple setup today, while the data model no longer assumes that.
export interface SetupDefinition {
  id: string;
  name: string;
  stockMode: StockMode;
  orientation: PartOrientation;
  placement: PartPlacement;
  wcsReference: WcsReference;
  wcs: WorkCoordinateSystem;
}

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

// WCS is the planned probing location on the real stock/part. Machine
// coordinates are established separately by the controller's homing cycle.
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
