export type ImportKind = 'step' | 'dxf';

export interface Bounds3 {
  min: [number, number, number];
  max: [number, number, number];
}

export interface ImportSummary {
  kind: ImportKind;
  fileName: string;
  backend: string;
  status: 'ready' | 'adapter-pending';
  entities: Record<string, number>;
  bounds?: Bounds3;
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

export const defaultStock: StockDefinition = {
  width: 200,
  height: 80,
  thickness: 22,
  offsetX: 10,
  offsetY: 10,
  offsetZ: 0
};
