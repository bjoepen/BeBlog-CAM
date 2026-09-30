import type { SemanticSegment } from './contourMath';
import type { AssumedClearedDisk } from './trochoidalSeedClearance';
import { buildStraightTrochoid, type StraightTrochoidOptions } from './trochoidalStraightMath';
import { boundMaterialExposureOutsideSeed } from './trochoidalMaterialExposure';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import { assessTrochoidalGuideEligibility } from './trochoidalGuideEligibility';
import { buildSemanticTrochoid } from './trochoidalSemanticMath';
import { proveTrochoidalCircleGuideBoundary, radialBoundsForNativeSegment } from './trochoidalCircularBoundary';
import { proveTrochoidalCapsuleGuideBoundary } from './trochoidalCapsuleBoundary';

export type SequentialMaterialResult =
  | { ok: true; segments: SemanticSegment[]; loopCount: number; cycleExposureBoundsDeg: number[];
      finalAssumedDisk: AssumedClearedDisk; closingExposureBoundDeg: number | null; errors: [] }
  | { ok: false; segments: []; loopCount: 0; cycleExposureBoundsDeg: [];
      finalAssumedDisk: null; closingExposureBoundDeg: null; failingCycleIndex: number | null; errors: string[] };

const MARGIN_MM = 1e-6;

const fail = (message: string, failingCycleIndex: number | null = null): SequentialMaterialResult =>
  ({ ok: false, segments: [], loopCount: 0, cycleExposureBoundsDeg: [], finalAssumedDisk: null,
    closingExposureBoundDeg: null, failingCycleIndex, errors: [message] });

/**
 * 010-E6B: conditional ordered assessment of the generated straight reference.
 * Credit a whole loop's sweep only AFTER its link and both arcs pass against
 * the previous assumed disk. No execution, entry or manufacturing release.
 */
export function assessStraightTrochoidSequentialMaterial(
  guide: Extract<SemanticSegment, { kind: 'line' }>, options: StraightTrochoidOptions,
  initialDisk: AssumedClearedDisk, cutterRadiusMm: number, targetDepthMm: number,
  allowedExposedAngleDeg: number
): SequentialMaterialResult {
  if (!guide || guide.kind !== 'line' || !guide.start || !guide.end || !options)
    return fail('Gerade Referenzführung und Schleifenparameter fehlen.');
  const reference = buildStraightTrochoid(guide, options);
  if (!reference.ok) return fail(reference.errors.join(' '));
  return assessGeneratedReference(reference, false, initialDisk, cutterRadiusMm, targetDepthMm, allowedExposedAngleDeg);
}

/** 010-E6C: native circle only; no arbitrary candidate can claim a full sweep. */
export function assessCircularTrochoidSequentialMaterial(
  guide: TrochoidalContourGuide, options: Omit<StraightTrochoidOptions, 'freeSide'>,
  initialDisk: AssumedClearedDisk, cutterRadiusMm: number, targetDepthMm: number,
  allowedExposedAngleDeg: number
): SequentialMaterialResult {
  if (!options) return fail('Schleifenparameter fehlen.');
  if (!Array.isArray(guide?.source) || !Array.isArray(guide?.segments)
    || guide.source.length !== 2 || guide.segments.length !== 2
    || [...guide.source, ...guide.segments].some(segment =>
      !radialBoundsForNativeSegment(segment, { x: 0, y: 0 })))
    return fail('Gültige native Zweibogen-Kreisführung fehlt.');
  const binding = proveTrochoidalCircleGuideBoundary(guide, guide.segments);
  if (!binding.ok) return fail(binding.errors.join(' '));
  const eligible = assessTrochoidalGuideEligibility(guide, options.radiusMm, options.forwardStepMm);
  if (!eligible.ok) return fail(eligible.errors.join(' '));
  const reference = buildSemanticTrochoid(guide.segments, { ...options,
    radiusMm: eligible.uniformRadiusMm, freeSide: eligible.freeSide });
  if (!reference.ok) return fail(reference.errors.join(' '));
  const boundary = proveTrochoidalCircleGuideBoundary(guide, reference.segments);
  if (!boundary.ok) return fail(boundary.errors.join(' '));
  return assessGeneratedReference(reference, true, initialDisk, cutterRadiusMm, targetDepthMm, allowedExposedAngleDeg);
}

/** 010-E6D: native capsule only, including its LINE/ARC transitions and closure. */
export function assessCapsuleTrochoidSequentialMaterial(
  guide: TrochoidalContourGuide, options: Omit<StraightTrochoidOptions, 'freeSide'>,
  initialDisk: AssumedClearedDisk, cutterRadiusMm: number, targetDepthMm: number,
  allowedExposedAngleDeg: number
): SequentialMaterialResult {
  if (!options) return fail('Schleifenparameter fehlen.');
  const binding = proveTrochoidalCapsuleGuideBoundary(guide, guide?.segments ?? []);
  if (!binding.ok) return fail(binding.errors.join(' '));
  const eligible = assessTrochoidalGuideEligibility(guide, options.radiusMm, options.forwardStepMm);
  if (!eligible.ok) return fail(eligible.errors.join(' '));
  const reference = buildSemanticTrochoid(guide.segments, { ...options,
    radiusMm: eligible.uniformRadiusMm, freeSide: eligible.freeSide });
  if (!reference.ok) return fail(reference.errors.join(' '));
  const boundary = proveTrochoidalCapsuleGuideBoundary(guide, reference.segments);
  if (!boundary.ok) return fail(boundary.errors.join(' '));
  return assessGeneratedReference(reference, true, initialDisk, cutterRadiusMm, targetDepthMm, allowedExposedAngleDeg);
}

// Private: only internal generators may supply complete loops.
function assessGeneratedReference(
  reference: { segments: SemanticSegment[]; loopCount: number }, closed: boolean,
  initialDisk: AssumedClearedDisk, cutterRadiusMm: number, targetDepthMm: number,
  allowedExposedAngleDeg: number
): SequentialMaterialResult {
  let disk = initialDisk;
  const exposureBounds: number[] = [];
  for (let cycle = 0; cycle < reference.loopCount; cycle++) {
    const offset = cycle === 0 ? 0 : 2 + (cycle - 1) * 3;
    const motions = reference.segments.slice(offset, offset + (cycle === 0 ? 2 : 3));
    const exposure = boundMaterialExposureOutsideSeed(disk, motions, cutterRadiusMm,
      targetDepthMm, allowedExposedAngleDeg);
    if (!exposure.ok || exposure.maxExposedAngleDeg === null)
      return fail(exposure.errors.join(' '), cycle);
    const arc = motions[motions.length - 1];
    if (arc.kind !== 'arc') return fail('Vollständige Referenzschleife fehlt.', cycle);
    // A full circular sweep covers radii [max(0,r-R), r+R]. The previous
    // disk must cover the central hole; retain reserves for native tolerances.
    const holeRadius = Math.max(0, arc.radius - cutterRadiusMm) + MARGIN_MM;
    const separation = Math.hypot(arc.center.x - disk.center.x, arc.center.y - disk.center.y);
    if (separation + holeRadius > disk.radiusMm - MARGIN_MM)
      return fail('Innenloch der Schleife ist nicht durch die vorherige freie Scheibe gedeckt.', cycle);
    const radiusMm = arc.radius + cutterRadiusMm - MARGIN_MM;
    if (!Number.isFinite(radiusMm) || radiusMm <= cutterRadiusMm + MARGIN_MM)
      return fail('Fortgeschriebene Scheibe hat keine belastbare Werkzeugreserve.', cycle);
    exposureBounds.push(exposure.maxExposedAngleDeg);
    // Only the target layer was cut: do not inherit the seed's deeper clearance.
    disk = { center: { ...arc.center }, radiusMm, clearedToDepthMm: targetDepthMm };
  }
  let closingExposureBoundDeg: number | null = null;
  if (closed) {
    const closing = boundMaterialExposureOutsideSeed(disk, reference.segments.slice(-1),
      cutterRadiusMm, targetDepthMm, allowedExposedAngleDeg);
    if (!closing.ok || closing.maxExposedAngleDeg === null)
      return fail(`Schließfahrt: ${closing.errors.join(' ')}`, reference.loopCount);
    closingExposureBoundDeg = closing.maxExposedAngleDeg;
    // A closing link earns no additional disk and no new depth clearance.
  }
  return { ok: true, segments: reference.segments, loopCount: reference.loopCount,
    cycleExposureBoundsDeg: exposureBounds, finalAssumedDisk: disk, closingExposureBoundDeg, errors: [] };
}
