import type { P2, SemanticSegment } from './contourMath';
import { radialBoundsForNativeSegment } from './trochoidalCircularBoundary';

/** An explicitly assumed cleared cylindrical region, not a verified stock-history token. */
export type AssumedClearedDisk = { center: P2; radiusMm: number; clearedToDepthMm: number };
export type SeedClearanceResult = {
  ok: boolean;
  maxFootprintRadiusMm: number;
  failingSegmentIndex: number | null;
  errors: string[];
};

const EPS = 1e-7;
const finite = (p: P2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 010-E5B conditional proof: the entire cutter disk at every native XY motion
 * lies inside a declared, already-cleared disk through the requested depth.
 * Open paths are allowed; entry, provenance and engagement remain unproven.
 */
export function proveAssumedSeedClearance(
  cleared: AssumedClearedDisk, path: SemanticSegment[], cutterRadiusMm: number, targetDepthMm: number
): SeedClearanceResult {
  const fail = (error: string, index: number | null, maximum = NaN): SeedClearanceResult =>
    ({ ok: false, maxFootprintRadiusMm: maximum, failingSegmentIndex: index, errors: [error] });
  if (!cleared || !finite(cleared.center) || !Number.isFinite(cleared.radiusMm) || cleared.radiusMm <= 0
    || !Number.isFinite(cleared.clearedToDepthMm) || cleared.clearedToDepthMm <= 0
    || !Number.isFinite(cutterRadiusMm) || cutterRadiusMm <= 0
    || !Number.isFinite(targetDepthMm) || targetDepthMm <= 0)
    return fail('Freigeräumte Scheibe, Werkzeugradius und Zieltiefe müssen endlich und positiv sein.', null);
  if (targetDepthMm > cleared.clearedToDepthMm)
    return fail('Startzone ist nicht bis zur Zieltiefe freigeräumt.', null);
  if (cutterRadiusMm >= cleared.radiusMm)
    return fail('Werkzeug passt nicht mit Reserve in die Startzone.', null);
  if (!Array.isArray(path) || path.length === 0) return fail('Startbewegung fehlt.', null);
  let maximum = 0;
  for (const [index, segment] of path.entries()) {
    const bounds = radialBoundsForNativeSegment(segment, cleared.center);
    if (!bounds) return fail(`Segment ${index + 1} ist keine gültige native Bewegung.`, index, maximum);
    if (index > 0 && distance(path[index - 1].end, segment.start) > EPS)
      return fail(`Startbewegung hat eine Lücke vor Segment ${index + 1}.`, index, maximum);
    maximum = Math.max(maximum, bounds.max + cutterRadiusMm);
    if (!Number.isFinite(maximum) || maximum > cleared.radiusMm - EPS)
      return fail(`Werkzeughülle von Segment ${index + 1} verlässt die angenommene freie Startzone.`, index, maximum);
  }
  return { ok: true, maxFootprintRadiusMm: maximum, failingSegmentIndex: null, errors: [] };
}
