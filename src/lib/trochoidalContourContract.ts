import type { CutDirection, ToolDefinition, ToolpathSide } from './types';

export const TROCHOIDAL_CONTOUR_OPERATION_KIND = 'trochoidal-contour-roughing' as const;
export const TROCHOIDAL_CONTOUR_STRATEGY = 'trochoidal-contour' as const;
export const TROCHOIDAL_CONTOUR_ENTRY_MODE = 'ramp' as const;

export type TrochoidalContourOperationKind = typeof TROCHOIDAL_CONTOUR_OPERATION_KIND;
export type TrochoidalContourStrategy = typeof TROCHOIDAL_CONTOUR_STRATEGY;
export type TrochoidalContourEntryMode = typeof TROCHOIDAL_CONTOUR_ENTRY_MODE;

export interface TrochoidalContourContract {
  id: string;
  kind: TrochoidalContourOperationKind;
  name: string;
  enabled: boolean;
  tool: ToolDefinition;

  /** v1 intentionally supports exactly one closed contour target. */
  contourId: number | null;
  side: Exclude<ToolpathSide, 'on-line'>;
  direction: CutDirection;

  /** Radius of the oscillating trochoidal cutter-center motion. */
  trochoidRadiusMm: number;
  /** Forward progress along the guide contour per trochoidal cycle. */
  forwardStepMm: number;

  /** v1 entry semantics are fixed to a proven ramp. */
  entryMode: TrochoidalContourEntryMode;
  rampAngleDeg: number;

  radialAllowanceMm: number;
  axialAllowanceMm: number;

  /** Manual depth or stock-bottom through-cut semantics. */
  depthMode?: 'manual' | 'stock-bottom';
  /** Additional depth below stock bottom when depthMode is stock-bottom. */
  overcutMm?: number;
  totalDepthMm: number;
  stepDownMm: number;
  feedMmMin: number;
  plungeMmMin: number;
  spindleRpm: number;
  safeZMm: number;
}

export type TrochoidalContourContractValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export const defaultTrochoidalContourContract: TrochoidalContourContract = {
  id: 'op-trochoidal-contour-1',
  kind: TROCHOIDAL_CONTOUR_OPERATION_KIND,
  name: 'Wirbelfräsen Kontur 1',
  enabled: true,
  tool: {
    id: 'tool-trochoidal-1',
    name: 'Schaftfräser 6 mm',
    diameterMm: 6,
    kind: 'end-mill',
    cuttingLengthMm: 15,
    stickoutMm: 25,
    shaftDiameterMm: 6,
    holderDiameterMm: 20
  },
  contourId: null,
  side: 'outside',
  direction: 'climb',
  trochoidRadiusMm: 4,
  forwardStepMm: 2,
  entryMode: TROCHOIDAL_CONTOUR_ENTRY_MODE,
  rampAngleDeg: 3,
  radialAllowanceMm: 0.2,
  axialAllowanceMm: 0,
  depthMode: 'manual',
  overcutMm: 0,
  totalDepthMm: 3,
  stepDownMm: 1,
  feedMmMin: 600,
  plungeMmMin: 180,
  spindleRpm: 12000,
  safeZMm: 5
};

export function validateTrochoidalContourContract(operation: TrochoidalContourContract): TrochoidalContourContractValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!operation.id?.trim()) errors.push('Wirbelfräsen Kontur benötigt eine stabile Operations-ID.');
  if (operation.kind !== TROCHOIDAL_CONTOUR_OPERATION_KIND) errors.push('Ungültiger Operationstyp für Wirbelfräsen Kontur.');
  if (operation.contourId === null || !Number.isInteger(operation.contourId) || operation.contourId < 0) errors.push('Wirbelfräsen Kontur benötigt genau eine gültige Kontur.');
  if (operation.side !== 'outside' && operation.side !== 'inside') errors.push('Wirbelfräsen Kontur benötigt Innen- oder Außenseite; Auf-Linie ist nicht freigegeben.');
  if (operation.tool.kind !== 'end-mill') errors.push('Wirbelfräsen Kontur v1 ist ausschließlich für Schaftfräser freigegeben.');
  if (!(operation.tool.diameterMm > 0)) errors.push('Werkzeugdurchmesser muss größer als 0 sein.');
  if (!(operation.trochoidRadiusMm > 0)) errors.push('Trochoidenradius muss größer als 0 sein.');
  if (!(operation.forwardStepMm > 0)) errors.push('Trochoiden-Fortschritt muss größer als 0 sein.');
  if (operation.entryMode !== TROCHOIDAL_CONTOUR_ENTRY_MODE) errors.push('Wirbelfräsen Kontur v1 verwendet ausschließlich Rampeneinstieg.');
  if (!(operation.rampAngleDeg > 0 && operation.rampAngleDeg <= 15)) errors.push('Rampenwinkel muss größer als 0° und höchstens 15° sein.');
  if(operation.depthMode!=='stock-bottom'&&!(operation.totalDepthMm > 0)) errors.push('Gesamttiefe muss größer als 0 sein.');
  if((operation.overcutMm??0)<0) errors.push('Überfräsen darf nicht negativ sein.');
  if (!(operation.stepDownMm > 0)) errors.push('Zustellung muss größer als 0 sein.');
  if (!(operation.feedMmMin > 0 && operation.plungeMmMin > 0 && operation.spindleRpm > 0)) errors.push('Vorschub, Rampenvorschub und Drehzahl müssen größer als 0 sein.');
  if (!(operation.safeZMm > 0)) errors.push('Sicherheits-Z muss größer als 0 sein.');
  if (!(operation.radialAllowanceMm >= 0) || !(operation.axialAllowanceMm >= 0)) errors.push('Aufmaße dürfen nicht negativ sein.');

  if (operation.forwardStepMm >= operation.tool.diameterMm) warnings.push('Trochoiden-Fortschritt erreicht oder überschreitet den Werkzeugdurchmesser; Eingriff muss in 010-C/E ausdrücklich bewiesen werden.');
  if (operation.stepDownMm > operation.totalDepthMm) warnings.push('Zustellung ist größer als die Gesamttiefe; die erste Tiefenstufe endet direkt auf Endtiefe.');

  return { ok: errors.length === 0, errors, warnings };
}
