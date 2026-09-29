import type { P2, SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';

export type CircularGuideDomain = { center: P2; radiusMm: number; side: 'outside' | 'inside' };
export type CircularBoundaryProof = {
  ok: boolean;
  measuredMinRadiusMm: number;
  measuredMaxRadiusMm: number;
  failingSegmentIndex: number | null;
  errors: string[];
};

const EPS = 1e-7;
const TAU = 2 * Math.PI;
const finite = (p: P2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);
const positive = (angle: number) => ((angle % TAU) + TAU) % TAU;

/** Exact radial extrema for one native LINE/ARC primitive; null for invalid geometry. */
export function radialBoundsForNativeSegment(segment: SemanticSegment, origin: P2): { min: number; max: number } | null {
  if (!segment || !finite(segment.start) || !finite(segment.end)) return null;
  const distances = [distance(segment.start, origin), distance(segment.end, origin)];
  if (segment.kind === 'line') {
    const dx = segment.end.x - segment.start.x, dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!Number.isFinite(lengthSquared) || lengthSquared <= EPS * EPS) return null;
    const t = Math.max(0, Math.min(1, ((origin.x - segment.start.x) * dx + (origin.y - segment.start.y) * dy) / lengthSquared));
    distances.push(Math.hypot(segment.start.x + t * dx - origin.x, segment.start.y + t * dy - origin.y));
  } else if (segment.kind === 'arc') {
    if (!finite(segment.center) || !Number.isFinite(segment.radius) || segment.radius <= 0
      || typeof segment.ccw !== 'boolean'
      || Math.abs(distance(segment.start, segment.center) - segment.radius) > EPS
      || Math.abs(distance(segment.end, segment.center) - segment.radius) > EPS) return null;
    const start = Math.atan2(segment.start.y - segment.center.y, segment.start.x - segment.center.x);
    const end = Math.atan2(segment.end.y - segment.center.y, segment.end.x - segment.center.x);
    const full = distance(segment.start, segment.end) <= EPS;
    const sweep = full ? TAU : segment.ccw ? positive(end - start) : positive(start - end);
    if (!full && sweep <= 1e-12) return null;
    const d = distance(segment.center, origin);
    if (d === 0) distances.push(segment.radius);
    else {
      const toward = Math.atan2(origin.y - segment.center.y, origin.x - segment.center.x);
      for (const angle of [toward, toward + Math.PI]) {
        const position = segment.ccw ? positive(angle - start) : positive(start - angle);
        if (full || position <= sweep + 1e-12) {
          distances.push(Math.hypot(segment.center.x + segment.radius * Math.cos(angle) - origin.x,
            segment.center.y + segment.radius * Math.sin(angle) - origin.y));
        }
      }
    }
  } else return null;
  if (distances.some(value => !Number.isFinite(value))) return null;
  return { min: Math.min(...distances), max: Math.max(...distances) };
}

/**
 * 010-E1: exact radial extrema of native lines/arcs against a circular guide.
 * This proves only that the candidate cutter-center path stays on its selected
 * side of that guide. It does NOT prove cleared stock, ramp, or engagement.
 */
export function proveCircularGuideBoundary(domain: CircularGuideDomain, path: SemanticSegment[]): CircularBoundaryProof {
  const fail = (error: string, index: number | null, min = NaN, max = NaN): CircularBoundaryProof =>
    ({ ok: false, measuredMinRadiusMm: min, measuredMaxRadiusMm: max, failingSegmentIndex: index, errors: [error] });
  if (!domain || !finite(domain.center) || !Number.isFinite(domain.radiusMm) || domain.radiusMm <= 0
    || (domain.side !== 'outside' && domain.side !== 'inside'))
    return fail('Ungültige Kreisführung oder Bearbeitungsseite.', null);
  if (!Array.isArray(path) || path.length === 0) return fail('Kandidatenbahn fehlt.', null);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const bounds = radialBoundsForNativeSegment(segment, domain.center);
    if (!bounds) return fail(`Segment ${i + 1} ist keine gültige native LINE/ARC-Bewegung.`, i, min, max);
    if (i > 0 && distance(path[i - 1].end, segment.start) > EPS)
      return fail(`Kandidatenbahn hat eine Lücke vor Segment ${i + 1}.`, i, min, max);
    min = Math.min(min, bounds.min);
    max = Math.max(max, bounds.max);
    if (domain.side === 'outside' ? bounds.min < domain.radiusMm - EPS : bounds.max > domain.radiusMm + EPS)
      return fail(`Segment ${i + 1} überschreitet die geschützte Kreisseite.`, i, min, max);
  }
  if (distance(path[path.length - 1].end, path[0].start) > EPS)
    return fail('Geschlossene Kreisführung benötigt eine geschlossene Kandidatenbahn.', path.length - 1, min, max);
  return { ok: true, measuredMinRadiusMm: min, measuredMaxRadiusMm: max, failingSegmentIndex: null, errors: [] };
}

/** 010-E4: bind the circular proof to a native, concentric 010-B guide. */
export function proveTrochoidalCircleGuideBoundary(guide: TrochoidalContourGuide, path: SemanticSegment[]): CircularBoundaryProof {
  const fail = (): CircularBoundaryProof => ({ ok: false, measuredMinRadiusMm: NaN,
    measuredMaxRadiusMm: NaN, failingSegmentIndex: null, errors: ['Keine gültige konzentrische Zweibogen-Kreisführung.'] });
  if (!guide?.validation?.ok || !Array.isArray(guide.source) || !Array.isArray(guide.segments)
    || guide.source.length !== 2 || guide.segments.length !== 2
    || !Number.isInteger(guide.contourId) || guide.contourId < 0
    || !Number.isFinite(guide.signedOffsetMm)
    || !Number.isFinite(guide.validation.expectedMm)
    || !Number.isFinite(guide.validation.measuredMinMm)
    || !Number.isFinite(guide.validation.measuredMaxMm)
    || guide.validation.segmentCount !== 2
    || (guide.side === 'outside' ? guide.signedOffsetMm <= 0 : guide.side === 'inside' ? guide.signedOffsetMm >= 0 : true)) return fail();
  const [a, b] = guide.segments, [s, t] = guide.source;
  if ([a, b, s, t].some(segment => segment.kind !== 'arc')) return fail();
  if (a.kind !== 'arc' || b.kind !== 'arc' || s.kind !== 'arc' || t.kind !== 'arc') return fail();
  const circlePair = (first: typeof a, second: typeof b) =>
    finite(first.center) && Number.isFinite(first.radius) && first.radius > EPS
    && first.ccw === second.ccw && typeof first.ccw === 'boolean'
    && distance(first.center, second.center) <= EPS && Math.abs(first.radius - second.radius) <= EPS
    && distance(first.start, second.end) <= EPS && distance(first.end, second.start) <= EPS
    && distance(first.start, first.end) >= first.radius * 2 - EPS
    && Math.abs(distance(first.start, first.center) - first.radius) <= EPS
    && Math.abs(distance(first.end, first.center) - first.radius) <= EPS
    && Math.abs(distance(second.start, second.center) - second.radius) <= EPS
    && Math.abs(distance(second.end, second.center) - second.radius) <= EPS;
  if (!circlePair(a, b) || !circlePair(s, t) || a.ccw !== s.ccw
    || distance(a.center, s.center) > EPS
    || Math.abs(a.radius - s.radius - guide.signedOffsetMm) > EPS
    || distance(a.start, { x: a.center.x + (s.start.x - s.center.x) * a.radius / s.radius,
      y: a.center.y + (s.start.y - s.center.y) * a.radius / s.radius }) > EPS
    || Math.abs(guide.validation.expectedMm - Math.abs(guide.signedOffsetMm)) > EPS
    || Math.abs(guide.validation.measuredMinMm - Math.abs(guide.signedOffsetMm)) > EPS
    || Math.abs(guide.validation.measuredMaxMm - Math.abs(guide.signedOffsetMm)) > EPS
    || !guide.validation.sideOk) return fail();
  return proveCircularGuideBoundary({ center: a.center, radiusMm: a.radius, side: guide.side }, path);
}
