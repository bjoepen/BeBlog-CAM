export type MillingToolKind = 'end-mill' | 'ball-nose' | 'face-mill' | 'v-bit' | 'drill' | 'fiber-cutter';

interface MillingToolBase {
  id: string;
  name: string;
  kind: MillingToolKind;
  diameterMm: number;
  flutes: number;
  chipLoadMm: number;
  /** Distance from tool tip to holder nose. */
  stickoutMm: number;
  /** Conservative cylindrical holder envelope used by 004Q. */
  holderDiameterMm: number;
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

export interface DrillTool extends MillingToolBase {
  kind: 'drill';
  cuttingLengthMm: number;
  shaftDiameterMm: number;
  pointAngleDeg: number;
}

export interface FiberCutterTool extends MillingToolBase {
  kind: 'fiber-cutter';
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

export type MillingTool = EndMillTool | BallNoseTool | FaceMillTool | VBitTool | DrillTool | FiberCutterTool;

export const millingToolKinds: MillingToolKind[] = ['end-mill', 'ball-nose', 'face-mill', 'v-bit', 'drill', 'fiber-cutter'];

export const millingToolLabels: Record<MillingToolKind, string> = {
  'end-mill': 'Schaftfräser',
  'ball-nose': 'Vollradiusfräser',
  'face-mill': 'Planfräser',
  'v-bit': 'Gravur / V-Fräser',
  'drill': 'Bohrer',
  'fiber-cutter': 'Faserfräser'
};

export const millingToolDescriptions: Record<MillingToolKind, string> = {
  'end-mill': 'Gerade Schneide für Konturen, Taschen und allgemeine 2,5D-Bearbeitung.',
  'ball-nose': 'Kugelförmige Stirn für 3D-Flächen, Rundungen und weiche Übergänge.',
  'face-mill': 'Großer Schneidkreis zum Planen ebener Flächen.',
  'v-bit': 'Konische Schneide für Gravuren und spätere V-Carve-Strategien.',
  'drill': 'Axiales Bohrwerkzeug; der Spitzenwinkel beschreibt Spiral- und Anbohrer.',
  'fiber-cutter': 'Faserverzahntes Fräswerkzeug; zunächst als eigene Bibliotheksgeometrie ohne spezielle CAM-Strategie.'
};

export function createMillingTool(kind: MillingToolKind, id = `tool-${Date.now()}`): MillingTool {
  if (kind === 'drill') {
    return { id, kind, name: 'Spiralbohrer 6 mm', diameterMm: 6, flutes: 2, chipLoadMm: 0.05, cuttingLengthMm: 30, shaftDiameterMm: 6, pointAngleDeg: 118, stickoutMm: 35, holderDiameterMm: 20 };
  }
  if (kind === 'fiber-cutter') {
    return { id, kind, name: 'Faserfräser 3 mm', diameterMm: 3, flutes: 1, chipLoadMm: 0.03, cuttingLengthMm: 12, shaftDiameterMm: 3, stickoutMm: 20, holderDiameterMm: 20 };
  }
  if (kind === 'ball-nose') {
    return { id, kind, name: 'Vollradiusfräser 6 mm', diameterMm: 6, flutes: 2, chipLoadMm: 0.04, cuttingLengthMm: 12, shaftDiameterMm: 6, stickoutMm: 25, holderDiameterMm: 20 };
  }
  if (kind === 'face-mill') {
    return { id, kind, name: 'Planfräser 20 mm', diameterMm: 20, flutes: 2, chipLoadMm: 0.08, maxDepthOfCutMm: 1, stickoutMm: 20, holderDiameterMm: 25 };
  }
  if (kind === 'v-bit') {
    return { id, kind, name: 'V-Fräser 60°', diameterMm: 6, flutes: 2, chipLoadMm: 0.025, angleDeg: 60, tipDiameterMm: 0.2, maxDiameterMm: 6, stickoutMm: 20, holderDiameterMm: 20 };
  }
  return { id, kind: 'end-mill', name: 'Schaftfräser 6 mm', diameterMm: 6, flutes: 2, chipLoadMm: 0.05, cuttingLengthMm: 15, shaftDiameterMm: 6, stickoutMm: 25, holderDiameterMm: 20 };
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isMillingTool(value: unknown): value is MillingTool {
  if (!value || typeof value !== 'object') return false;
  const tool = value as Partial<MillingTool> & Record<string, unknown>;
  if (typeof tool.id !== 'string' || typeof tool.name !== 'string' || !millingToolKinds.includes(tool.kind as MillingToolKind)) return false;
  if (!positive(tool.diameterMm) || !positive(tool.flutes) || !positive(tool.chipLoadMm) || !positive(tool.stickoutMm) || !positive(tool.holderDiameterMm)) return false;
  if (tool.holderDiameterMm < tool.diameterMm) return false;
  if (tool.kind === 'end-mill' || tool.kind === 'ball-nose' || tool.kind === 'fiber-cutter') return positive(tool.cuttingLengthMm) && positive(tool.shaftDiameterMm) && tool.stickoutMm >= tool.cuttingLengthMm && tool.shaftDiameterMm >= tool.diameterMm && tool.holderDiameterMm >= tool.shaftDiameterMm;
  if (tool.kind === 'drill') return positive(tool.cuttingLengthMm) && positive(tool.shaftDiameterMm) && positive(tool.pointAngleDeg) && tool.pointAngleDeg < 180 && tool.stickoutMm >= tool.cuttingLengthMm && tool.shaftDiameterMm >= tool.diameterMm && tool.holderDiameterMm >= tool.shaftDiameterMm;
  if (tool.kind === 'face-mill') return positive(tool.maxDepthOfCutMm);
  return positive(tool.angleDeg) && positive(tool.tipDiameterMm) && positive(tool.maxDiameterMm) && tool.tipDiameterMm <= tool.maxDiameterMm;
}

/** Migrate older library entries to the holder-aware 004Q type model. */
export function migrateMillingTool(value: unknown): MillingTool | null {
  if (isMillingTool(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const old = value as Record<string, unknown>;
  if (typeof old.id !== 'string' || typeof old.name !== 'string' || !positive(old.diameterMm) || !positive(old.flutes) || !positive(old.chipLoadMm)) return null;
  const kind=millingToolKinds.includes(old.kind as MillingToolKind)?old.kind as MillingToolKind:'end-mill';
  const base={id:old.id,name:old.name,diameterMm:old.diameterMm,flutes:old.flutes,chipLoadMm:old.chipLoadMm,stickoutMm:positive(old.stickoutMm)?old.stickoutMm:Math.max(old.diameterMm*4,20),holderDiameterMm:positive(old.holderDiameterMm)?old.holderDiameterMm:Math.max(old.diameterMm,20)};
  if(kind==='ball-nose'||kind==='end-mill'||kind==='fiber-cutter'||kind==='drill'){
    const cuttingLengthMm=positive(old.cuttingLengthMm)?old.cuttingLengthMm:Math.max(old.diameterMm*2,1),shaftDiameterMm=positive(old.shaftDiameterMm)?old.shaftDiameterMm:old.diameterMm;
    const geometry={...base,cuttingLengthMm,shaftDiameterMm,stickoutMm:Math.max(base.stickoutMm,cuttingLengthMm),holderDiameterMm:Math.max(base.holderDiameterMm,shaftDiameterMm)};
    if(kind==='drill')return {...geometry,kind:'drill',pointAngleDeg:positive(old.pointAngleDeg)&&old.pointAngleDeg<180?old.pointAngleDeg:118};
    if(kind==='ball-nose')return {...geometry,kind:'ball-nose'};
    if(kind==='fiber-cutter')return {...geometry,kind:'fiber-cutter'};
    return {...geometry,kind:'end-mill'};
  }
  if(kind==='face-mill')return {...base,kind,maxDepthOfCutMm:positive(old.maxDepthOfCutMm)?old.maxDepthOfCutMm:1,holderDiameterMm:Math.max(base.holderDiameterMm,old.diameterMm)};
  return {...base,kind,angleDeg:positive(old.angleDeg)?old.angleDeg:60,tipDiameterMm:positive(old.tipDiameterMm)?old.tipDiameterMm:.2,maxDiameterMm:positive(old.maxDiameterMm)?old.maxDiameterMm:old.diameterMm};
}

export function toolGeometrySummary(tool: MillingTool): string {
  const assembly=`Auskragung ${tool.stickoutMm} mm · Halter Ø ${tool.holderDiameterMm} mm`;
  if (tool.kind === 'drill') return `Ø ${tool.diameterMm} mm · Spitzenwinkel ${tool.pointAngleDeg}° · Nutzlänge ${tool.cuttingLengthMm} mm · Schaft Ø ${tool.shaftDiameterMm} mm · ${assembly}`;
  if (tool.kind === 'fiber-cutter') return `Ø ${tool.diameterMm} mm · Schneidenlänge ${tool.cuttingLengthMm} mm · Schaft Ø ${tool.shaftDiameterMm} mm · ${assembly}`;
  if (tool.kind === 'end-mill') return `Ø ${tool.diameterMm} mm · Schneidenlänge ${tool.cuttingLengthMm} mm · Schaft Ø ${tool.shaftDiameterMm} mm · ${assembly}`;
  if (tool.kind === 'ball-nose') return `Ø ${tool.diameterMm} mm · R ${tool.diameterMm / 2} mm · Schneidenlänge ${tool.cuttingLengthMm} mm · ${assembly}`;
  if (tool.kind === 'face-mill') return `Ø ${tool.diameterMm} mm · max. ap ${tool.maxDepthOfCutMm} mm · ${assembly}`;
  return `${tool.angleDeg}° · Spitze Ø ${tool.tipDiameterMm} mm · max. Ø ${tool.maxDiameterMm} mm · ${assembly}`;
}
