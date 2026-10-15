/**
 * Build 011-C: chip-thickness advisory for peripheral end milling.
 * Geometry-only, no physics/force model and never modifies an operation.
 * Ae must represent actual radial width of cut, NOT a CAM lane-distance estimate.
 */
export type ChipThicknessInput = {
  cutterDiameterMm: number;
  radialWidthMm: number;
  fluteCount: number;
  spindleRpm: number;
  programmedFeedMmMin: number;
  targetChipThicknessMm?: number;
  maxFeedMmMin?: number;
};

export type ChipThicknessResult =
  | { status: 'unavailable'; reason: string }
  | {
      status: 'advisory';
      engagementAngleDeg: number;
      chipThicknessFactor: number;
      programmedToothFeedMm: number;
      estimatedMaxChipThicknessMm: number;
      compensatedToothFeedMm: number | null;
      compensatedFeedMmMin: number | null;
      feedCapActive: boolean;
      notes: string[];
    };

const pos = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;
const round = (x: number) => Math.round(x * 1e6) / 1e6;

/**
 * Standard idealized peripheral milling: maximum chip-thickness factor.
 * For ae/D < 0.5: 2 sqrt(q(1-q)), where q = ae/D.
 * For ae/D >= 0.5: 1 (maximum chip thickness reaches fz).
 * Full radial immersion (ae = D, slotting) is mathematically covered by
 * factor = 1; this does NOT imply that full-slot machining is safe.
 * Not applicable to plunging, helixes, ballnose or
 * evolving stock contact without a known effective ae.
 */
export function assessChipThickness(input: ChipThicknessInput): ChipThicknessResult {
  if (!input || !pos(input.cutterDiameterMm) || !pos(input.radialWidthMm) ||
      input.radialWidthMm > input.cutterDiameterMm ||
      !Number.isInteger(input.fluteCount) || input.fluteCount < 1 ||
      !pos(input.spindleRpm) || !pos(input.programmedFeedMmMin) ||
      (input.targetChipThicknessMm !== undefined && !pos(input.targetChipThicknessMm)) ||
      (input.maxFeedMmMin !== undefined && !pos(input.maxFeedMmMin)))
    return { status: 'unavailable', reason: 'Ungültige Eingaben oder ae außerhalb des Fräserdurchmessers.' };

  const q = input.radialWidthMm / input.cutterDiameterMm;
  const factor = q >= 0.5 ? 1 : 2 * Math.sqrt(q * (1 - q));
  if (!pos(factor)) return { status: 'unavailable', reason: 'Spanungsdickenfaktor nicht bestimmbar.' };
  const engagementAngleDeg = Math.acos(1 - 2 * q) * 180 / Math.PI;
  const toothFeed = input.programmedFeedMmMin / (input.spindleRpm * input.fluteCount);
  const target = input.targetChipThicknessMm;
  const uncompensated = target === undefined ? null : target / factor * input.spindleRpm * input.fluteCount;
  const recommended = uncompensated === null ? null :
    Math.min(uncompensated, input.maxFeedMmMin ?? Number.POSITIVE_INFINITY);
  return {
    status: 'advisory',
    engagementAngleDeg: round(engagementAngleDeg),
    chipThicknessFactor: round(factor),
    programmedToothFeedMm: round(toothFeed),
    estimatedMaxChipThicknessMm: round(toothFeed * factor),
    compensatedToothFeedMm: recommended === null ? null : round(recommended / (input.spindleRpm * input.fluteCount)),
    compensatedFeedMmMin: recommended === null ? null : round(recommended),
    feedCapActive: uncompensated !== null && recommended !== null && recommended < uncompensated,
    notes: [
      'Idealisierte maximale Spanungsdicke bei peripherem Fräsen; keine Kraft-, Temperatur- oder Standzeitberechnung.',
      'Erfordert tatsächlich bekannte radiale Eingriffsbreite; für Rampen, Helix und wechselnde Materialumschlingung nicht freigegeben.',
      ...(uncompensated !== null && recommended !== null && recommended < uncompensated ?
        ['Maschinenvorschubgrenze begrenzt die vorgeschlagene Kompensation.'] : [])
    ]
  };
}

export type CuttingPlausibility = { level: 'pass' | 'warn' | 'unavailable'; messages: string[] };
/** Non-blocking assessment against an advisory range, never a manufacturing gate. */
export function assessAdvisoryRange(value: number, range: { minMm: number; maxMm: number }): CuttingPlausibility {
  if (!Number.isFinite(value) || value <= 0 || !range ||
      !pos(range.minMm) || !pos(range.maxMm) || range.minMm > range.maxMm)
    return { level: 'unavailable', messages: ['Kein gültiger Vergleich mit dem Empfehlungsbereich möglich.'] };
  if (value < range.minMm || value > range.maxMm)
    return { level: 'warn', messages: ['Einstellung liegt außerhalb des heuristischen Empfehlungsbereichs; manuelle Prüfung empfohlen.'] };
  return { level: 'pass', messages: ['Einstellung liegt innerhalb des heuristischen Empfehlungsbereichs.'] };
}
