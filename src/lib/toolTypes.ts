export type MillingToolKind = 'end-mill' | 'ball-nose' | 'face-mill' | 'v-bit';

interface MillingToolBase {
  id: string;
  name: string;
  kind: MillingToolKind;
  diameterMm: number;
  flutes: number;
  chipLoadMm: number;
}

export interface EndMillTool extends MillingToolBase {
  kind: 'end-mill';
  cuttingLengthMm: number;
  shaftDiameterMm: number;
}

export interface BallNoseTool extends MillingToolBase {
  kind: 'ball-nose';
  cuttingLengthMm: number;
  shaftDiameterMm: number;
}

export interface FaceMillTool extends MillingToolBase {
  kind: 'face-mill';
  maxDepthOfCutMm: number;
}

export interface VBitTool extends MillingToolBase {
  kind: 'v-bit';
  angleDeg: number;
  tipDiameterMm: number;
  maxDiameterMm: number;
}

export type MillingTool = EndMillTool | BallNoseTool | FaceMillTool | VBitTool;

export const millingToolKinds: MillingToolKind[] = ['end-mill', 'ball-nose', 'face-mill', 'v-bit'];

export const millingToolLabels: Record<MillingToolKind, string> = {
  'end-mill': 'Schaftfräser',
  'ball-nose': 'Vollradiusfräser',
  'face-mill': 'Planfräser',
  'v-bit': 'Gravur / V-Fräser'
};

export const millingToolDescriptions: Record<MillingToolKind, string> = {
  'end-mill': 'Gerade Schneide für Konturen, Taschen und allgemeine 2,5D-Bearbeitung.',
  'ball-nose': 'Kugelförmige Stirn für 3D-Flächen, Rundungen und weiche Übergänge.',
  'face-mill': 'Großer Schneidkreis zum Planen ebener Flächen.',
  'v-bit': 'Konische Schneide für Gravuren und spätere V-Carve-Strategien.'
};

export function createMillingTool(kind: MillingToolKind, id = `tool-${Date.now()}`): MillingTool {
  if (kind === 'ball-nose') {
    return { id, kind, name: 'Vollradiusfräser 6 mm', diameterMm: 6, flutes: 2, chipLoadMm: 0.04, cuttingLengthMm: 12, shaftDiameterMm: 6 };
  }
  if (kind === 'face-mill') {
    return { id, kind, name: 'Planfräser 20 mm', diameterMm: 20, flutes: 2, chipLoadMm: 0.08, maxDepthOfCutMm: 1 };
  }
  if (kind === 'v-bit') {
    return { id, kind, name: 'V-Fräser 60°', diameterMm: 6, flutes: 2, chipLoadMm: 0.025, angleDeg: 60, tipDiameterMm: 0.2, maxDiameterMm: 6 };
  }
  return { id, kind: 'end-mill', name: 'Schaftfräser 6 mm', diameterMm: 6, flutes: 2, chipLoadMm: 0.05, cuttingLengthMm: 15, shaftDiameterMm: 6 };
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isMillingTool(value: unknown): value is MillingTool {
  if (!value || typeof value !== 'object') return false;
  const tool = value as Partial<MillingTool> & Record<string, unknown>;
  if (typeof tool.id !== 'string' || typeof tool.name !== 'string' || !millingToolKinds.includes(tool.kind as MillingToolKind)) return false;
  if (!positive(tool.diameterMm) || !positive(tool.flutes) || !positive(tool.chipLoadMm)) return false;
  if (tool.kind === 'end-mill' || tool.kind === 'ball-nose') return positive(tool.cuttingLengthMm) && positive(tool.shaftDiameterMm);
  if (tool.kind === 'face-mill') return positive(tool.maxDepthOfCutMm);
  return positive(tool.angleDeg) && positive(tool.tipDiameterMm) && positive(tool.maxDiameterMm) && tool.tipDiameterMm <= tool.maxDiameterMm;
}

/** Migrate 001S/v1 library entries to the explicit 001T type model. */
export function migrateMillingTool(value: unknown): MillingTool | null {
  if (isMillingTool(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const old = value as { id?: unknown; name?: unknown; diameterMm?: unknown; flutes?: unknown; chipLoadMm?: unknown };
  if (typeof old.id !== 'string' || typeof old.name !== 'string' || !positive(old.diameterMm) || !positive(old.flutes) || !positive(old.chipLoadMm)) return null;
  return {
    id: old.id,
    kind: 'end-mill',
    name: old.name,
    diameterMm: old.diameterMm,
    flutes: old.flutes,
    chipLoadMm: old.chipLoadMm,
    cuttingLengthMm: Math.max(old.diameterMm * 2, 1),
    shaftDiameterMm: old.diameterMm
  };
}

export function toolGeometrySummary(tool: MillingTool): string {
  if (tool.kind === 'end-mill') return `Ø ${tool.diameterMm} mm · Schneidenlänge ${tool.cuttingLengthMm} mm · Schaft Ø ${tool.shaftDiameterMm} mm`;
  if (tool.kind === 'ball-nose') return `Ø ${tool.diameterMm} mm · R ${tool.diameterMm / 2} mm · Schneidenlänge ${tool.cuttingLengthMm} mm`;
  if (tool.kind === 'face-mill') return `Ø ${tool.diameterMm} mm · max. ap ${tool.maxDepthOfCutMm} mm`;
  return `${tool.angleDeg}° · Spitze Ø ${tool.tipDiameterMm} mm · max. Ø ${tool.maxDiameterMm} mm`;
}
