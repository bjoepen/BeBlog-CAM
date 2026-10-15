import type { CamOperation } from './types';
import type { CuttingRecommendation } from './cuttingEngagementRecommendation';

/** Build 011-D2: explicit, opt-in operation edit. Not a toolpath or safety approval. */
export type EngagementTransferSelection = { applyAxial: boolean; applyRadial: boolean };
export type EngagementTransferResult =
  | { status: 'unavailable'; reason: string }
  | { status: 'ready'; operation: CamOperation; changed: ('stepDownMm'|'stepoverPercent')[]; notices: string[] };

const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Apply only to the currently selected operation, with explicit user checkboxes.
 * Radial step-over is a lane-distance parameter, not proven actual ae.
 * Contour/trochoid have no equivalent radial width field.
 */
export function prepareEngagementTransfer(
  operation: CamOperation,
  advice: CuttingRecommendation,
  selected: EngagementTransferSelection
): EngagementTransferResult {
  const unavailable = (reason: string): EngagementTransferResult => ({ status:'unavailable', reason });
  if (!operation || !advice || advice.status !== 'advisory' ||
      !advice.radial || !advice.axial || !selected ||
      (!selected.applyAxial && !selected.applyRadial))
    return unavailable('Keine gültige und ausdrücklich ausgewählte Parameterübernahme.');
  if (operation.tool.kind !== 'end-mill')
    return unavailable('Die Zustellungsempfehlungen gelten nur für Schaftfräser.');
  if (!positive(operation.tool.diameterMm))
    return unavailable('Ungültiger Fräserdurchmesser.');
  const changed: ('stepDownMm'|'stepoverPercent')[] = [];
  const notices: string[] = [];
  let updated = { ...operation } as CamOperation;
  if (selected.applyAxial) {
    if (operation.kind === 'pocket' && operation.entry === 'helix')
      return unavailable('Helix-Pitch pro Umdrehung darf nicht als axiale Zustellung übernommen werden.');
    if (operation.kind === 'drill' || operation.kind === 'carve' || operation.kind === 'surface-finishing')
      return unavailable('Für diesen Operationstyp steht keine axiale Übernahme zur Verfügung.');
    if (!positive(advice.axial.preferredMm) ||
        (positive(operation.tool.cuttingLengthMm) && advice.axial.preferredMm > operation.tool.cuttingLengthMm))
      return unavailable('Axialer Wert verletzt die Schneidenlängen-/Gültigkeitsgrenze.');
    updated = { ...updated, stepDownMm: advice.axial.preferredMm } as CamOperation;
    changed.push('stepDownMm');
  }
  if (selected.applyRadial) {
    // Only linear lane-distance parameters have the same units as the proposed width.
    if (operation.kind !== 'facing' && operation.kind !== 'pocket' &&
        operation.kind !== 'z-level-roughing' && operation.kind !== '3d-roughing')
      return unavailable('Dieser Operationstyp hat keine freigegebene Spurabstand-Übernahme.');
    if (!positive(advice.radial.preferredMm) || advice.radial.preferredMm > operation.tool.diameterMm)
      return unavailable('Radialer Wert liegt außerhalb des Fräserdurchmessers.');
    const percent = Math.round(advice.radial.preferredMm / operation.tool.diameterMm * 10000) / 100;
    if (!positive(percent) || percent > 100)
      return unavailable('Spurabstand nicht als gültiger Prozentwert darstellbar.');
    updated = { ...updated, stepoverPercent: percent } as CamOperation;
    changed.push('stepoverPercent');
    notices.push('Spurabstand wurde angepasst; der tatsächliche radiale Materialeingriff ist damit nicht nachgewiesen.');
  }
  return { status: 'ready', operation: updated, changed, notices };
}
