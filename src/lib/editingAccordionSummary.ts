import type { CamOperation, ImportSummary } from './types';
import { zLevelMode } from './zLevelOperationState';
import { dxfTargetIds } from './operationsProject';

export type EditingImportKind = ImportSummary['kind'] | null;

export type EditingAccordionSummaries = {
  target: string;
  toolAndCut: string;
  strategy: string;
};

const dxfTargetCount = (operation: Extract<CamOperation, { kind: 'contour' | 'pocket' }>) =>
  dxfTargetIds(operation).length;

function targetSummary(operation: CamOperation, importKind: EditingImportKind): string {
  switch (operation.kind) {
    case 'facing':
      return 'Keine Geometrieauswahl erforderlich';
    case 'carve':
      return importKind === 'dxf'
        ? `${operation.curveIds.length} offene DXF-Geometrien ausgewählt`
        : 'STEP-Carve ist nicht verfügbar';
    case 'drill':
      if (importKind === 'step') {
        const count = operation.stepHoleFeatureIds?.length ?? 0;
        return count === 0 ? 'Auswahl erforderlich · keine STEP-Bohrung gewählt' : `${count} STEP-Bohrungen ausgewählt`;
      }
      if (importKind === 'dxf') {
        return operation.curveIds.length === 0
          ? 'Auswahl erforderlich · keine DXF-Bohrung gewählt'
          : `${operation.curveIds.length} DXF-Bohrungen ausgewählt`;
      }
      return 'Geometrieauswahl nicht verfügbar';
    case 'contour':
      if (importKind === 'step') {
        const faces = operation.stepContourFaceIds?.length ?? 0;
        const wire = operation.stepWireId == null ? 0 : 1;
        return faces === 0 && wire === 0
          ? 'Auswahl erforderlich · keine STEP-Kontur gewählt'
          : `${wire} STEP-Wire · ${faces} STEP-Flächen gewählt`;
      }
      if (importKind === 'dxf') {
        const count = operation.topology === 'open'
          ? (operation.contourId === null ? 0 : 1)
          : dxfTargetCount(operation);
        return count === 0
          ? 'Auswahl erforderlich · keine DXF-Kontur gewählt'
          : `${count} DXF-Kontur${count === 1 ? '' : 'en'} ausgewählt`;
      }
      return 'Geometrieauswahl nicht verfügbar';
    case 'pocket':
      if (importKind === 'step') {
        return operation.stepFaceId == null
          ? 'Auswahl erforderlich · keine STEP-Fläche gewählt'
          : '1 STEP-Fläche ausgewählt';
      }
      if (importKind === 'dxf') {
        const count = dxfTargetCount(operation);
        return count === 0
          ? 'Auswahl erforderlich · keine DXF-Kontur gewählt'
          : `${count} DXF-Kontur${count === 1 ? '' : 'en'} ausgewählt`;
      }
      return 'Geometrieauswahl nicht verfügbar';
    case 'trochoidal-contour-roughing':
      if (importKind !== 'dxf') return 'Wirbelkontur ist nur für DXF verfügbar';
      return operation.contourId === null ? 'Auswahl erforderlich · keine DXF-Kontur gewählt' : '1 geschlossene DXF-Kontur ausgewählt';
    case 'z-level-roughing':
      if (zLevelMode(operation) === 'model') return 'Gesamtmodell · keine Flächenauswahl erforderlich';
      return operation.faceIds.length === 0
        ? 'Auswahl erforderlich · keine STEP-Fläche gewählt'
        : `${operation.faceIds.length} STEP-Flächen ausgewählt`;
    case '3d-roughing':
    case 'surface-finishing':
      return operation.faceIds.length === 0
        ? 'Auswahl erforderlich · keine STEP-Fläche gewählt'
        : `${operation.faceIds.length} STEP-Flächen ausgewählt`;
  }
}

function toolAndCutSummary(operation: CamOperation): string {
  const diameter = operation.tool.diameterMm.toFixed(2);
  const rpm = Math.round(operation.spindleRpm);
  const feed = Math.round(operation.feedMmMin);
  const cutDepth = operation.kind === 'z-level-roughing' || operation.kind === '3d-roughing' || operation.kind === 'surface-finishing'
    ? `Zustellung ${operation.stepDownMm} mm`
    : operation.kind === 'drill' && operation.depthMode === 'stock-bottom'
      ? 'Tiefe bis Rohlingunterseite'
      : operation.kind === 'contour' && operation.depthMode === 'stock-bottom'
        ? 'Tiefe bis Rohlingunterseite'
        : `Tiefe ${operation.totalDepthMm} mm · Zustellung ${operation.stepDownMm} mm`;
  return `Ø ${diameter} mm · ${rpm} 1/min · ${feed} mm/min · ${cutDepth}`;
}

function strategySummary(operation: CamOperation): string {
  switch (operation.kind) {
    case 'facing':
      return `Bahnen ${operation.direction.toUpperCase()} · Zustellung ${operation.stepoverPercent}%`;
    case 'carve':
      return `Geometrie ${operation.selectionMode === 'layer' ? 'nach Ebene' : 'einzeln'} · ${operation.side === 'on-line' ? 'auf Linie' : operation.side === 'left' ? 'links' : 'rechts'}`;
    case 'drill':
      return `${operation.method === 'drill' ? 'Axial bohren' : 'Helixfräsen'} · ${operation.depthMode === 'stock-bottom' ? 'Durch Rohling' : 'Manuelle Tiefe'}`;
    case 'contour':
      return `${operation.topology === 'closed' ? 'Geschlossene' : 'Offene'} Kontur · ${operation.side === 'outside' ? 'außen' : operation.side === 'inside' ? 'innen' : 'auf Linie'} · ${operation.direction === 'climb' ? 'Gleichlauf' : 'Gegenlauf'}`;
    case 'trochoidal-contour-roughing':
      return `Wirbelradius ${operation.trochoidRadiusMm.toFixed(2)} mm · ${operation.side === 'outside' ? 'außen' : 'innen'} · ${operation.direction === 'climb' ? 'Gleichlauf' : 'Gegenlauf'}`;
    case 'pocket':
      return `${operation.strategy === 'auto' ? 'Automatisch' : operation.strategy === 'raster' ? 'Raster' : operation.strategy === 'concentric' ? 'Kreis' : 'Konturparallel'} · ${operation.entry === 'plunge' ? 'senkrecht' : operation.entry === 'ramp' ? 'Rampe' : 'Helix'}`;
    case 'z-level-roughing':
      return `${zLevelMode(operation) === 'model' ? 'Gesamtmodell' : 'Ziel-Fläche'} · Inseln ${operation.islandMode === 'clear' ? 'mit schruppen' : 'stehen lassen'}`;
    case '3d-roughing':
      return `Parallel ${((operation.direction ?? 'x').toUpperCase())} · Zustellung ${operation.stepoverPercent}%`;
    case 'surface-finishing':
      return `Parallel ${operation.direction.toUpperCase()} · Zustellung ${operation.stepoverPercent}%`;
  }
}

export function buildEditingAccordionSummaries(
  operation: CamOperation,
  importKind: EditingImportKind,
): EditingAccordionSummaries {
  return {
    target: targetSummary(operation, importKind),
    toolAndCut: toolAndCutSummary(operation),
    strategy: strategySummary(operation),
  };
}
