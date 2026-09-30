import type { P2, SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import { measureSemanticGuide } from './trochoidalSemanticMath';

export type CapsuleBoundaryProof = {
  ok: boolean;
  measuredMinDistanceMm: number;
  measuredMaxDistanceMm: number;
  failingSegmentIndex: number | null;
  errors: string[];
};
type Spine = { start: P2; end: P2; radius: number; length: number; unit: P2 };
const EPS = 1e-6, TAU = 2 * Math.PI;
const finite = (p: P2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const dist = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);
const dot = (a: P2, b: P2) => a.x * b.x + a.y * b.y;
const sub = (a: P2, b: P2): P2 => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: P2, b: P2) => a.x * b.y - a.y * b.x;
const positive = (a: number) => ((a % TAU) + TAU) % TAU;
const pointOn = (arc: Extract<SemanticSegment, { kind: 'arc' }>, angle: number): P2 =>
  ({ x: arc.center.x + arc.radius * Math.cos(angle), y: arc.center.y + arc.radius * Math.sin(angle) });

function sweepOf(arc: Extract<SemanticSegment, { kind: 'arc' }>): number {
  const start = Math.atan2(arc.start.y - arc.center.y, arc.start.x - arc.center.x);
  const end = Math.atan2(arc.end.y - arc.center.y, arc.end.x - arc.center.x);
  const full = dist(arc.start, arc.end) <= EPS;
  return full ? TAU : arc.ccw ? positive(end - start) : positive(start - end);
}

function capsuleSpine(guide: TrochoidalContourGuide): Spine | null {
  if (!guide?.validation?.ok || (guide.side !== 'inside' && guide.side !== 'outside')) return null;
  const segments = guide.segments;
  if (segments?.length !== 4) return null;
  const measured = measureSemanticGuide(segments);
  if (!measured.ok || !measured.metric.closed) return null;
  const arcs = segments.filter((s): s is Extract<SemanticSegment, { kind: 'arc' }> => s.kind === 'arc');
  const lines = segments.filter((s): s is Extract<SemanticSegment, { kind: 'line' }> => s.kind === 'line');
  if (arcs.length !== 2 || lines.length !== 2 || Math.abs(arcs[0].radius - arcs[1].radius) > EPS) return null;
  const start = arcs[0].center, end = arcs[1].center, length = dist(start, end), radius = arcs[0].radius;
  if (!Number.isFinite(length) || length <= EPS) return null;
  const unit = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  for (let i = 0; i < 2; i++) {
    if (Math.abs(sweepOf(arcs[i]) - Math.PI) > EPS) return null;
    const angle = Math.atan2(arcs[i].start.y - arcs[i].center.y, arcs[i].start.x - arcs[i].center.x)
      + (arcs[i].ccw ? 1 : -1) * sweepOf(arcs[i]) / 2;
    const middle = sub(pointOn(arcs[i], angle), arcs[i].center);
    const outward = i === 0 ? -radius : radius;
    if (Math.abs(dot(middle, unit) - outward) > EPS || Math.abs(cross(unit, middle)) > EPS) return null;
  }
  const signs: number[] = [];
  for (const line of lines) {
    const p = sub(line.start, start), q = sub(line.end, start);
    const projections = [dot(p, unit), dot(q, unit)].sort((a, b) => a - b);
    const n0 = cross(unit, p), n1 = cross(unit, q);
    if (Math.abs(projections[0]) > EPS || Math.abs(projections[1] - length) > EPS
      || Math.abs(n0 - n1) > EPS || Math.abs(Math.abs(n0) - radius) > EPS) return null;
    signs.push(Math.sign(n0));
  }
  if (signs[0] === signs[1]) return null;
  return { start, end, radius, length, unit };
}

function distanceToSpine(p: P2, spine: Spine): number {
  const t = Math.max(0, Math.min(spine.length, dot(sub(p, spine.start), spine.unit)));
  return Math.hypot(p.x - spine.start.x - t * spine.unit.x, p.y - spine.start.y - t * spine.unit.y);
}

function lineBounds(line: Extract<SemanticSegment, { kind: 'line' }>, spine: Spine): { min: number; max: number } | null {
  if (!finite(line.start) || !finite(line.end)) return null;
  const v = sub(line.end, line.start), w = sub(spine.end, spine.start), vv = dot(v, v);
  if (!Number.isFinite(vv) || vv <= EPS * EPS) return null;
  const values = [distanceToSpine(line.start, spine), distanceToSpine(line.end, spine)];
  for (const p of [spine.start, spine.end]) {
    const t = Math.max(0, Math.min(1, dot(sub(p, line.start), v) / vv));
    values.push(dist({ x: line.start.x + v.x * t, y: line.start.y + v.y * t }, p));
  }
  const denominator = cross(v, w);
  if (Math.abs(denominator) > EPS * EPS) {
    const offset = sub(spine.start, line.start);
    const t = cross(offset, w) / denominator, u = cross(offset, v) / denominator;
    if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) values.push(0);
  }
  return values.every(Number.isFinite) ? { min: Math.min(...values), max: Math.max(values[0], values[1]) } : null;
}

function arcBounds(arc: Extract<SemanticSegment, { kind: 'arc' }>, spine: Spine): { min: number; max: number } | null {
  if (!finite(arc.start) || !finite(arc.end) || !finite(arc.center) || !Number.isFinite(arc.radius)
    || arc.radius <= 0 || typeof arc.ccw !== 'boolean'
    || Math.abs(dist(arc.start, arc.center) - arc.radius) > EPS
    || Math.abs(dist(arc.end, arc.center) - arc.radius) > EPS) return null;
  const startAngle = Math.atan2(arc.start.y - arc.center.y, arc.start.x - arc.center.x);
  const sweep = sweepOf(arc), full = dist(arc.start, arc.end) <= EPS;
  const candidateAngles: number[] = [];
  const axis = Math.atan2(spine.unit.y, spine.unit.x), normal = axis + Math.PI / 2;
  candidateAngles.push(axis, axis + Math.PI, normal, normal + Math.PI);
  for (const endpoint of [spine.start, spine.end]) {
    const a = Math.atan2(endpoint.y - arc.center.y, endpoint.x - arc.center.x);
    candidateAngles.push(a, a + Math.PI);
  }
  const baseProjection = dot(sub(arc.center, spine.start), spine.unit);
  for (const target of [0, spine.length]) {
    const ratio = (target - baseProjection) / arc.radius;
    if (Math.abs(ratio) <= 1) {
      const angle = Math.acos(Math.max(-1, Math.min(1, ratio)));
      candidateAngles.push(axis + angle, axis - angle);
    }
  }
  // Endpoints are unconditional witnesses. Angle normalization near 0/2π must
  // never remove them from a nearly full or seam-crossing native arc.
  const values = [distanceToSpine(arc.start, spine), distanceToSpine(arc.end, spine), ...candidateAngles
    .filter(a => full || (arc.ccw ? positive(a - startAngle) : positive(startAngle - a)) <= sweep + 1e-10)
    .map(a => distanceToSpine(pointOn(arc, a), spine))];
  return values.length && values.every(Number.isFinite) ? { min: Math.min(...values), max: Math.max(...values) } : null;
}

/** Exact distance extrema against a proven stadium/capsule guide; no stock proof. */
export function proveCapsuleGuideBoundary(guide: TrochoidalContourGuide, path: SemanticSegment[]): CapsuleBoundaryProof {
  const fail = (message: string, index: number | null, min = NaN, max = NaN): CapsuleBoundaryProof =>
    ({ ok: false, measuredMinDistanceMm: min, measuredMaxDistanceMm: max, failingSegmentIndex: index, errors: [message] });
  const spine = capsuleSpine(guide);
  if (!spine) return fail('010-E3 unterstützt nur eine geschlossene, tangentiale Kapsel-Führung aus LINE/ARC.', null);
  if (!Array.isArray(path) || path.length === 0) return fail('Kandidatenbahn fehlt.', null);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const bounds = segment?.kind === 'line' ? lineBounds(segment, spine)
      : segment?.kind === 'arc' ? arcBounds(segment, spine) : null;
    if (!bounds) return fail(`Kandidatensegment ${i + 1} ist ungültig.`, i, min, max);
    if (i > 0 && dist(path[i - 1].end, segment.start) > EPS)
      return fail(`Lücke vor Kandidatensegment ${i + 1}.`, i, min, max);
    min = Math.min(min, bounds.min); max = Math.max(max, bounds.max);
    if (guide.side === 'outside' ? bounds.min < spine.radius - EPS : bounds.max > spine.radius + EPS)
      return fail(`Kandidatensegment ${i + 1} überschreitet die geschützte Kapselseite.`, i, min, max);
  }
  if (dist(path[path.length - 1].end, path[0].start) > EPS)
    return fail('Geschlossene Kapsel benötigt eine geschlossene Kandidatenbahn.', path.length - 1, min, max);
  return { ok: true, measuredMinDistanceMm: min, measuredMaxDistanceMm: max, failingSegmentIndex: null, errors: [] };
}

/** 010-E6D: bind the capsule domain to its concentric native source offset. */
export function proveTrochoidalCapsuleGuideBoundary(
  guide: TrochoidalContourGuide, path: SemanticSegment[]
): CapsuleBoundaryProof {
  const fail = (): CapsuleBoundaryProof => ({ ok: false, measuredMinDistanceMm: NaN,
    measuredMaxDistanceMm: NaN, failingSegmentIndex: null,
    errors: ['Keine gültige native Kapsel-Führung mit gebundenem Sollkontur-Offset.'] });
  if (!guide?.validation?.ok || !Array.isArray(guide.source) || !Array.isArray(guide.segments)
    || guide.source.length !== 4 || guide.segments.length !== 4
    || !Number.isInteger(guide.contourId) || guide.contourId < 0
    || !Number.isFinite(guide.signedOffsetMm)
    || (guide.side === 'outside' ? guide.signedOffsetMm <= 0 : guide.side === 'inside' ? guide.signedOffsetMm >= 0 : true)
    || guide.validation.segmentCount !== 4 || !guide.validation.sideOk
    || [guide.validation.expectedMm, guide.validation.measuredMinMm, guide.validation.measuredMaxMm]
      .some(value => !Number.isFinite(value) || Math.abs(value - Math.abs(guide.signedOffsetMm)) > EPS))
    return fail();
  const source = capsuleSpine({ ...guide, segments: guide.source }), target = capsuleSpine(guide);
  if (!source || !target || dist(source.start, target.start) > EPS || dist(source.end, target.end) > EPS
    || Math.abs(target.radius - source.radius - guide.signedOffsetMm) > EPS) return fail();
  // Same primitive order, direction and radial attachment: the offset may not
  // silently relabel a different native contour or rotate/reverse its station.
  for (let i = 0; i < 4; i++) {
    const s = guide.source[i], t = guide.segments[i];
    if (s.kind !== t.kind) return fail();
    if (s.kind === 'arc' && t.kind === 'arc') {
      if (s.ccw !== t.ccw || dist(s.center, t.center) > EPS) return fail();
      for (const end of ['start', 'end'] as const) {
        const expected = { x: s.center.x + (s[end].x - s.center.x) * t.radius / s.radius,
          y: s.center.y + (s[end].y - s.center.y) * t.radius / s.radius };
        if (dist(expected, t[end]) > EPS) return fail();
      }
    } else if (s.kind === 'line' && t.kind === 'line') {
      const sv = sub(s.end, s.start), tv = sub(t.end, t.start);
      if (dist(sv, tv) > EPS) return fail();
    }
  }
  return proveCapsuleGuideBoundary(guide, path);
}

/** Conservative distance of a whole disk from the protected source side. */
export function capsuleDiskPartClearanceMm(
  guide: TrochoidalContourGuide, disk: { center: P2; radiusMm: number }
): number | null {
  if (!disk || !finite(disk.center) || !Number.isFinite(disk.radiusMm) || disk.radiusMm <= 0
    || !proveTrochoidalCapsuleGuideBoundary(guide, guide?.segments ?? []).ok) return null;
  const source = capsuleSpine({ ...guide, segments: guide.source });
  if (!source) return null;
  const d = distanceToSpine(disk.center, source);
  // Distance to a segment is 1-Lipschitz. These disk bounds are sufficient
  // on both sides, including across an endpoint's circular cap.
  return guide.side === 'outside' ? d - disk.radiusMm - source.radius
    : source.radius - d - disk.radiusMm;
}
