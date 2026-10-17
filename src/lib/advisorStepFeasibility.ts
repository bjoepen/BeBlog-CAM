import type { ImportSummary, PartOrientation, StockMode, WorkCoordinateSystem, DrillMethod, DrillOperation } from './types';
import type { MillingTool } from './toolTypes';
import type { MaterialKind } from './materialContext';
import { buildOrientedStepManufacturingFeatureSource } from './stepManufacturingFeatures';
import { recognizeStepHoles } from './stepHoleRecognition';
import { validateToolCompatibility } from './validationGrammar';

/**
 * Development 011-B: a deliberately conservative, read-only feasibility *screen*.
 * No toolpaths, operations project mutations, stores, or NC generation.
 * This does not substitute for production preflight.
 */
export type AdvisorCoverage = 'DIRECT' | 'ALTERNATIVE' | 'CONDITIONAL' | 'NOT_COVERED' | 'UNKNOWN';
export type AdvisorStrategy = {
  method: DrillMethod;
  toolId: string;
  toolName: string;
  status: 'candidate' | 'conditional';
  reasons: string[];
};
export type AdvisorFeature = {
  featureId: string;
  kind: 'hole' | 'unclassified-cylinder';
  faceIds: number[];
  diameterMm?: number;
  depthMm?: number;
  coverage: AdvisorCoverage;
  strategies: AdvisorStrategy[];
  reasons: string[];
};
export type AdvisorReport = {
  version: 1;
  status: 'screened' | 'unavailable';
  sourceFileName: string;
  material: MaterialKind;
  features: AdvisorFeature[];
  notes: string[];
};

/** Use existing operation/tool compatibility as the source of truth; do not reproduce tool-kind policy. */
function compatibility(method: DrillMethod, tool: MillingTool): 'pass' | 'warn' | 'fail' {
  const operation = {
    kind: 'drill', method,
    tool: { id: tool.id, name: tool.name, diameterMm: tool.diameterMm, kind: tool.kind },
  } as DrillOperation;
  return validateToolCompatibility(operation).level;
}

export function screenStepFeasibility(args: {
  summary: ImportSummary;
  orientation: PartOrientation;
  stockMode: StockMode;
  wcs: WorkCoordinateSystem;
  material: MaterialKind;
  tools: readonly MillingTool[];
}): AdvisorReport {
  const { summary, orientation, stockMode, wcs, material, tools } = args;
  const notes = [
    'Nur Vorprüfung erkannter Zylinderfeatures; keine Fertigungs- oder Kollisionsfreigabe.',
    'Taschen, Konturen und nicht erkannte Geometrie werden in 011-B noch nicht vollständig bewertet.',
    'Werkzeug-Eignung zum Helix-Eintauchen und vollständige Maschinen-/Halterkollision sind nicht nachgewiesen.',
  ];
  const unavailable = (reason: string): AdvisorReport => ({
    version: 1, status: 'unavailable', sourceFileName: summary.fileName,
    material, features: [], notes: [...notes, reason],
  });
  if (summary.kind !== 'step') return unavailable('Nur STEP-Modelle sind in 011-B vorgesehen.');
  if (stockMode === 'none') return unavailable('Rohling fehlt.');
  if (wcs.z !== 'top') return unavailable('Aktuelle STEP-Bohrstrategie benötigt WCS Z oben.');
  const source = buildOrientedStepManufacturingFeatureSource(summary, orientation);
  if (!source.ok) return unavailable(source.errors.join(' | '));
  const recognized = recognizeStepHoles(source.source);
  const features: AdvisorFeature[] = recognized.holes.map(hole => {
    const reasons: string[] = [];
    const strategies: AdvisorStrategy[] = [];
    if (Math.abs(Math.abs(hole.axisDirection[2]) - 1) > 1e-5) {
      reasons.push('Bohrungsachse nicht parallel zur Maschinen-Z-Achse.');
    } else {
      for (const tool of tools) {
        if (!(tool.diameterMm > 0)) continue;
        const methods: DrillMethod[] = ['drill', 'helical-mill'];
        for (const method of methods) {
          const compatibilityLevel = compatibility(method, tool);
          if (compatibilityLevel === 'fail') continue;
          if (method === 'drill' && Math.abs(tool.diameterMm - hole.diameterMm) > 0.01) continue;
          if (method === 'helical-mill' && tool.diameterMm >= hole.diameterMm - 1e-6) continue;
          const cautions: string[] = [];
          if (compatibilityLevel === 'warn') cautions.push('Werkzeugkompatibilität ist nur mit Warnung freigegeben.');
          if (method === 'drill' && tool.kind !== 'drill') cautions.push('Axiales Eintauchen mit Schaftfräser muss gesondert freigegeben werden.');
          if (!('cuttingLengthMm' in tool) || !(tool.cuttingLengthMm >= hole.depthMm)) cautions.push('Schneidenlänge nicht nachgewiesen oder kürzer als Featuretiefe.');
          if (!(tool.stickoutMm > hole.depthMm)) cautions.push('Auskragung nicht nachgewiesen oder unzureichend.');
          if (method === 'helical-mill') cautions.push('Helix-Eintauchfähigkeit, Freiraum und Preflight noch nicht geprüft.');
          if (method === 'drill') cautions.push('Bohrtiefe, Werkzeugspitze, Freiraum und vollständiger Preflight noch nicht geprüft.');
          strategies.push({ method, toolId: tool.id, toolName: tool.name, status: cautions.length ? 'conditional' : 'candidate', reasons: cautions });
        }
      }
    }
    const direct = strategies.some(s => s.method === 'drill' && s.status === 'candidate');
    const alternative = strategies.some(s => s.method === 'helical-mill' && s.status === 'candidate');
    const coverage: AdvisorCoverage = direct ? 'DIRECT' : alternative ? 'ALTERNATIVE' : strategies.length ? 'CONDITIONAL' : 'NOT_COVERED';
    if (!strategies.length && !reasons.length) reasons.push('Keine kompatible Werkzeug-/Bohrstrategie-Kombination gefunden.');
    return { featureId: hole.featureId, kind: 'hole', faceIds: [...hole.faceIds], diameterMm: hole.diameterMm, depthMm: hole.depthMm, coverage, strategies, reasons };
  });
  for (const faceId of recognized.rejectedCylinderFaceIds) {
    features.push({ featureId: `step-cylinder-face-${faceId}`, kind: 'unclassified-cylinder', faceIds: [faceId], coverage: 'UNKNOWN', strategies: [], reasons: ['Zylinderfläche konservativ nicht als Bohrung erkannt.'] });
  }
  if (!features.length) notes.push('Keine sicher erkannten Bohrungen; keine Aussage zur Fertigbarkeit anderer Features.');
  return { version: 1, status: 'screened', sourceFileName: summary.fileName, material, features, notes };
}
