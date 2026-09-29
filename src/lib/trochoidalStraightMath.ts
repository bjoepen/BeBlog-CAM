import type { P2, SemanticSegment } from './contourMath';

export type StraightTrochoidOptions = {
  radiusMm: number;
  forwardStepMm: number;
  /** Which local half-plane is available for the oscillation. Not inferred from inside/outside. */
  freeSide: 'left' | 'right';
  loopDirection: 'cw' | 'ccw';
};

export type StraightTrochoidResult =
  | { ok: true; segments: SemanticSegment[]; loopCount: number; errors: [] }
  | { ok: false; segments: []; loopCount: 0; errors: string[] };

const MAX_LOOPS = 10000;
const finite = (p: P2) => Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * 010-C reference geometry only. Each two-arc loop touches a straight guide once;
 * consecutive loops are linked on the free-side apex, not along the design side.
 * Cutter-envelope, stock, engagement and ramp checks are intentionally NOT supplied.
 */
export function buildStraightTrochoid(
  guide: Extract<SemanticSegment, { kind: 'line' }>, options: StraightTrochoidOptions
): StraightTrochoidResult {
  const { radiusMm: radius, forwardStepMm: step, freeSide, loopDirection } = options;
  const fail = (reason: string): StraightTrochoidResult => ({ ok: false, segments: [], loopCount: 0, errors: [reason] });
  if (!finite(guide.start) || !finite(guide.end)) return fail('Gerade enthält ungültige Koordinaten.');
  const dx = guide.end.x - guide.start.x, dy = guide.end.y - guide.start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 1e-9) return fail('Führung muss eine nichtdegenerierte Gerade sein.');
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(step) || step <= 0)
    return fail('Trochoidenradius und Fortschritt müssen endlich und positiv sein.');
  if (step > 2 * radius) return fail('Fortschritt überschreitet den Schleifendurchmesser; die Schleifen überlappen nicht.');
  if (freeSide !== 'left' && freeSide !== 'right') return fail('Freiseite muss links oder rechts liegen.');
  if (loopDirection !== 'cw' && loopDirection !== 'ccw') return fail('Ungültige Schleifenrichtung.');
  const intervals = Math.ceil(length / step);
  if (intervals + 1 > MAX_LOOPS) return fail('Zu viele Trochoidenschleifen für die Referenzgeometrie.');

  const tangent = { x: dx / length, y: dy / length };
  const sign = freeSide === 'left' ? 1 : -1;
  const normal = { x: -tangent.y * sign, y: tangent.x * sign };
  const at = (s: number): P2 => ({ x: guide.start.x + tangent.x * s, y: guide.start.y + tangent.y * s });
  const shifted = (p: P2, amount: number): P2 => ({ x: p.x + normal.x * amount, y: p.y + normal.y * amount });
  const segments: SemanticSegment[] = [];
  let previousApex: P2 | null = null;
  for (let i = 0; i <= intervals; i++) {
    const station = i === intervals ? length : Math.min(i * step, length);
    const touch = at(station), center = shifted(touch, radius), apex = shifted(touch, 2 * radius);
    if (previousApex) segments.push({ kind: 'line', start: previousApex, end: apex });
    // Two semicircles retain native G2/G3-compatible arcs and avoid a full-circle
    // start=end ambiguity. Both arcs have the same center and winding.
    const ccw = loopDirection === 'ccw';
    segments.push({ kind: 'arc', start: apex, end: touch, center, radius, ccw });
    segments.push({ kind: 'arc', start: touch, end: apex, center, radius, ccw });
    previousApex = apex;
  }
  return { ok: true, segments, loopCount: intervals + 1, errors: [] };
}
