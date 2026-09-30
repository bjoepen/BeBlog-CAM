import type { P2, SemanticSegment } from './contourMath';
import type { AssumedClearedDisk } from './trochoidalSeedClearance';
import { radialBoundsForNativeSegment } from './trochoidalCircularBoundary';

export type MaterialExposureBound = {
  ok: boolean;
  /** Upper bound on total cutter circumference outside the assumed cleared disk. */
  maxExposedAngleDeg: number | null;
  limitingSegmentIndex: number | null;
  firstLimitExceededSegmentIndex: number | null;
  errors: string[];
};

const GEOMETRY_EPS_MM = 1e-7;
const DISK_MARGIN_MM = 1e-6;
const ANGLE_MARGIN_DEG = 1e-7;
const finite = (p: P2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);

function exposedAngleDeg(centerDistance: number, clearedRadius: number, cutterRadius: number): number | null {
  if (centerDistance + cutterRadius <= clearedRadius) return 0;
  if (centerDistance >= clearedRadius + cutterRadius) return 360;
  // Circle intersection: d² + R² + 2dR cos(theta) = S².
  // Normalize to avoid squared machine-coordinate overflow.
  const scale = Math.max(centerDistance, clearedRadius, cutterRadius);
  const d = centerDistance / scale, s = clearedRadius / scale, r = cutterRadius / scale;
  const denominator = 2 * d * r;
  if (denominator <= 0 || !Number.isFinite(denominator)) return null;
  // Round toward greater exposure. Tiny circle-intersection denominators
  // deliberately lose precision conservatively instead of producing a pass.
  const roundoff = 64 * Number.EPSILON;
  const cosine = (s * s - d * d - r * r - roundoff) / denominator - roundoff;
  if (!Number.isFinite(cosine)) return null;
  return Math.min(360, 2 * Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI + ANGLE_MARGIN_DEG);
}

/**
 * 010-E6A conditional, static material bound. Treat everything outside one
 * assumed cleared cylinder as stock, and credit no removal by this candidate.
 * Circumference exposure is not feed-relative radial engagement or NC release.
 */
export function boundMaterialExposureOutsideSeed(
  cleared: AssumedClearedDisk, path: SemanticSegment[], cutterRadiusMm: number,
  targetDepthMm: number, allowedExposedAngleDeg: number
): MaterialExposureBound {
  const invalid = (error: string): MaterialExposureBound => ({ ok: false, maxExposedAngleDeg: null,
    limitingSegmentIndex: null, firstLimitExceededSegmentIndex: null, errors: [error] });
  if (!cleared || !finite(cleared.center) || !Number.isFinite(cleared.radiusMm)
    || !Number.isFinite(cleared.clearedToDepthMm) || cleared.clearedToDepthMm <= 0
    || !Number.isFinite(cutterRadiusMm) || cutterRadiusMm <= 0
    || cleared.radiusMm - DISK_MARGIN_MM <= cutterRadiusMm)
    return invalid('Angenommene Startzone muss das Werkzeug mit positiver Reserve umfassen.');
  if (!Number.isFinite(targetDepthMm) || targetDepthMm <= 0 || targetDepthMm > cleared.clearedToDepthMm)
    return invalid('Zieltiefe liegt außerhalb der angenommenen Vorfreiräumung.');
  if (!Number.isFinite(allowedExposedAngleDeg) || allowedExposedAngleDeg < 0 || allowedExposedAngleDeg >= 180)
    return invalid('Umfangsbedeckungsgrenze muss endlich sein und zwischen 0° und weniger als 180° liegen.');
  if (!Array.isArray(path) || path.length === 0) return invalid('Kandidatenbahn fehlt.');
  let maximum = 0, limitingSegmentIndex = 0, firstLimitExceededSegmentIndex: number | null = null;
  for (const [index, segment] of path.entries()) {
    const bounds = radialBoundsForNativeSegment(segment, cleared.center);
    if (!bounds) return invalid(`Segment ${index + 1} ist keine gültige native LINE/ARC-Bewegung.`);
    const coordinates = [cleared.center, segment.start, segment.end,
      ...(segment.kind === 'arc' ? [segment.center] : [])];
    const scale = Math.max(cleared.radiusMm, cutterRadiusMm, bounds.max,
      ...(segment.kind === 'arc' ? [segment.radius] : []),
      ...coordinates.flatMap(p => [Math.abs(p.x), Math.abs(p.y)]));
    if (64 * Number.EPSILON * scale > GEOMETRY_EPS_MM)
      return invalid('Koordinatengröße überschreitet das numerische Reservebudget.');
    if (index > 0 && distance(path[index - 1].end, segment.start) > GEOMETRY_EPS_MM)
      return invalid(`Kandidatenbahn hat eine Lücke vor Segment ${index + 1}.`);
    // For S > R, the exposed angle is monotone in d. The whole primitive is
    // therefore bounded by its exact radial maximum, not endpoint sampling.
    const d = bounds.max + GEOMETRY_EPS_MM;
    if (!Number.isFinite(d)) return invalid('Abstandsschranke ist nicht endlich.');
    const angle = exposedAngleDeg(d, cleared.radiusMm - DISK_MARGIN_MM, cutterRadiusMm);
    if (angle === null) return invalid('Umfangsbedeckung ist numerisch nicht bestimmbar.');
    if (angle > maximum) { maximum = angle; limitingSegmentIndex = index; }
    if (angle > allowedExposedAngleDeg && firstLimitExceededSegmentIndex === null)
      firstLimitExceededSegmentIndex = index;
  }
  const ok = firstLimitExceededSegmentIndex === null;
  return { ok, maxExposedAngleDeg: maximum, limitingSegmentIndex, firstLimitExceededSegmentIndex,
    errors: ok ? [] : [`Kandidatenbahn überschreitet die Umfangsbedeckungsgrenze von ${allowedExposedAngleDeg}°.`] };
}
