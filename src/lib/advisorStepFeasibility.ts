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

/** 011-D: A report is only reusable against the exact reviewed input context.
 * The caller supplies the geometry identity and capability revision explicitly;
 * filename alone is not a safe geometry identity. No mutable stores are read.
 */
export type AdvisorContext = {
  geometryIdentity: string;
  capabilityRevision: string;
  summary: ImportSummary;
  orientation: PartOrientation;
  stockMode: StockMode;
  stockSnapshot: unknown;
  wcs: WorkCoordinateSystem;
  material: MaterialKind;
  tools: readonly MillingTool[];
};
export type AdvisorContextSnapshot = { version: 1; serialized: string };

export function captureAdvisorContext(context: AdvisorContext): AdvisorContextSnapshot | null {
  if (!context.geometryIdentity.trim() || !context.capabilityRevision.trim()) return null;
  // JSON snapshots reject undefined and nonfinite values instead of silently
  // dropping or coercing them (JSON.stringify alone is not fail-closed).
  const seen = new WeakSet<object>();
  const valid = (value: unknown): boolean => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) {
      return Object.keys(value).length === value.length && value.every(valid);
    }
    // JSON.stringify silently collapses Map, Set, Date and class instances.
    // Only JSON-shaped plain objects are permitted in reviewed context.
    const prototype = Object.getPrototypeOf(value);
    // Accept plain objects across VM/iframe realms (their Object.prototype differs).
    // Reject Map/Set/Date/class instances whose prototype has another ancestor.
    if (prototype !== null && Object.getPrototypeOf(prototype) !== null) return false;
    const object = value as Record<string, unknown>;
    if (Object.getOwnPropertySymbols(object).length > 0) return false;
    const keys = Object.keys(object);
    if (Reflect.ownKeys(object).length !== keys.length) return false;
    return keys.every(key => valid(object[key]));
  };
  if (!valid(context)) return null;
  return { version: 1, serialized: JSON.stringify(context) };
}

export function isAdvisorContextCurrent(
  reviewed: AdvisorContextSnapshot | null,
  current: AdvisorContext
): boolean {
  if (!reviewed || reviewed.version !== 1) return false;
  const next = captureAdvisorContext(current);
  return !!next && next.serialized === reviewed.serialized;
}

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
    if (!Number.isFinite(hole.diameterMm) || hole.diameterMm <= 0 ||
        !Number.isFinite(hole.depthMm) || hole.depthMm <= 0 ||
        !Array.isArray(hole.axisDirection) || hole.axisDirection.length !== 3 ||
        !hole.axisDirection.every(Number.isFinite)) {
      reasons.push('Bohrungsgeometrie unvollständig oder ungültig; keine Strategie bewertbar.');
    } else if (Math.abs(Math.abs(hole.axisDirection[2]) - 1) > 1e-5) {
      reasons.push('Bohrungsachse nicht parallel zur Maschinen-Z-Achse.');
    } else {
      for (const tool of tools) {
        if (!Number.isFinite(tool.diameterMm) || tool.diameterMm <= 0) continue;
        const methods: DrillMethod[] = ['drill', 'helical-mill'];
        for (const method of methods) {
          const compatibilityLevel = compatibility(method, tool);
          if (compatibilityLevel === 'fail') continue;
          if (method === 'drill' && Math.abs(tool.diameterMm - hole.diameterMm) > 0.01) continue;
          if (method === 'helical-mill' && tool.diameterMm >= hole.diameterMm - 1e-6) continue;
          const cautions: string[] = [];
          if (compatibilityLevel === 'warn') cautions.push('Werkzeugkompatibilität ist nur mit Warnung freigegeben.');
          if (method === 'drill' && tool.kind !== 'drill') cautions.push('Axiales Eintauchen mit Schaftfräser muss gesondert freigegeben werden.');
          if (!('cuttingLengthMm' in tool) || !Number.isFinite(tool.cuttingLengthMm) || !(tool.cuttingLengthMm >= hole.depthMm)) cautions.push('Schneidenlänge nicht nachgewiesen oder kürzer als Featuretiefe.');
          if (!Number.isFinite(tool.stickoutMm) || !(tool.stickoutMm > hole.depthMm)) cautions.push('Auskragung nicht nachgewiesen oder unzureichend.');
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
