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
