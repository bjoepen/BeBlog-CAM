import type { MaterialKind } from './materialContext';
import type { MillingToolKind } from './toolTypes';

/**
 * 011-B: purely advisory starting ranges. No force/temperature simulation,
 * no toolpath modification and no manufacturing clearance.
 */
export type CuttingRecommendationInput = {
  material: MaterialKind;
  toolKind: MillingToolKind;
  diameterMm: number;
  cuttingLengthMm?: number;
  maxDepthOfCutMm?: number;
  operation: 'facing' | 'contour' | 'pocket' | 'trochoidal-contour-roughing' |
    'z-level-roughing' | '3d-roughing' | 'surface-finishing' | 'drill' | 'carve';
  machineRigidity: 'light' | 'medium' | 'rigid';
};

export type RecommendationRange = {
  minMm: number;
  preferredMm: number;
  maxMm: number;
  basis: string;
};

export type CuttingRecommendation = {
  status: 'advisory' | 'unavailable';
  radial: RecommendationRange | null;
  axial: RecommendationRange | null;
  notes: string[];
};

const finitePositive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;
const round = (v: number) => Math.round(v * 1000) / 1000;
const supportedMaterials: MaterialKind[] = ['wood-mdf', 'plastic', 'aluminium', 'steel'];
const supportedOperations: CuttingRecommendationInput['operation'][] =
  ['facing', 'contour', 'pocket', 'trochoidal-contour-roughing', 'z-level-roughing', '3d-roughing'];
const rigidityFactors = { light: 0.55, medium: 0.8, rigid: 1 } as const;

// Deliberately conservative *starting assumptions*, not proven cutting limits.
// Material and operation are kept separate so later evidence can replace this matrix.
const materialFactors: Record<MaterialKind, number> = {
  'wood-mdf': 1, plastic: 0.8, aluminium: 0.6, steel: 0.35
};
const radialFractions: Record<(typeof supportedOperations)[number], number> = {
  facing: 0.45,
  contour: 0.22,
  pocket: 0.28,
  'trochoidal-contour-roughing': 0.18,
  'z-level-roughing': 0.25,
  '3d-roughing': 0.2
};
const axialFractions: Record<(typeof supportedOperations)[number], number> = {
  facing: 0.2,
  contour: 0.3,
  pocket: 0.24,
  'trochoidal-contour-roughing': 0.35,
  'z-level-roughing': 0.25,
  '3d-roughing': 0.2
};

function range(preferred: number, physicalCap: number, basis: string): RecommendationRange | null {
  const best = Math.min(preferred, physicalCap);
  const min = round(best * 0.6), recommended = round(best), max = round(Math.min(best * 1.25, physicalCap));
  if (min <= 0 || recommended <= 0 || max < recommended) return null;
  return { minMm: min, preferredMm: recommended, maxMm: max, basis };
}

export function recommendCuttingEngagement(input: CuttingRecommendationInput): CuttingRecommendation {
  const notes: string[] = [];
  const unavailable = (reason: string): CuttingRecommendation =>
    ({ status: 'unavailable', radial: null, axial: null, notes: [reason] });

  if (!input || !finitePositive(input.diameterMm) ||
      !(input.machineRigidity in rigidityFactors) ||
      !supportedMaterials.includes(input.material))
    return unavailable('Ungültige Werkzeug-, Material- oder Maschinenangaben.');
  if (input.toolKind !== 'end-mill')
    return unavailable('011-B berechnet zunächst nur Empfehlungen für Schaftfräser; keine Übertragung auf andere Werkzeugtypen.');
  if (!supportedOperations.includes(input.operation))
    return unavailable('Für diese Operation liegt noch kein freigegebener Empfehlungsansatz vor.');
  if (!finitePositive(input.cuttingLengthMm))
    return unavailable('Eine gültige Schneidenlänge ist für eine axiale Empfehlung erforderlich.');

  const factor = rigidityFactors[input.machineRigidity] * materialFactors[input.material];
  const radial = range(input.diameterMm * radialFractions[input.operation] * factor,
    input.diameterMm, 'Heuristischer Startbereich nach Material, Strategie und Maschinenklasse');
  const axial = range(input.diameterMm * axialFractions[input.operation] * factor,
    input.cuttingLengthMm, 'Heuristischer Startbereich, begrenzt durch die Schneidenlänge');
  if (!radial || !axial) return unavailable('Die Empfehlungswerte sind für diese Abmessungen nicht sinnvoll darstellbar.');

  notes.push('Orientierungswerte, keine validierten Belastungs- oder Kollisionsgrenzen.');
  notes.push('Werkzeughersteller, Auskragung, Spannmittel, Spanabfuhr und tatsächliche Maschinensteifigkeit separat prüfen.');
  if (input.operation === 'trochoidal-contour-roughing')
    notes.push('Die produktive 140°-Materialumschlingungsgrenze bleibt unabhängig von dieser Empfehlung verbindlich.');
  if (input.material === 'steel')
    notes.push('Stahl: Maschinensteifigkeit, Werkzeugbeschichtung und Kühlsituation besonders kritisch; nur als vorsichtiger Startpunkt.');
  return { status: 'advisory', radial, axial, notes };
}
