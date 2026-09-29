import type { SemanticSegment } from './contourMath';
import type { TrochoidalContourGuide } from './trochoidalContourGuide';
import { measureSemanticGuide } from './trochoidalSemanticMath';

export type TrochoidalGuideEligibility =
  | { ok: true; freeSide: 'left' | 'right'; uniformRadiusMm: number; reduced: boolean; limitingSegmentIndex: number | null; errors: [] }
  | { ok: false; freeSide: null; uniformRadiusMm: null; reduced: false; limitingSegmentIndex: number | null; errors: string[] };

function signedArea(segments: SemanticSegment[]): number {
  let area = 0;
  for (const segment of segments) {
    area += (segment.start.x * segment.end.y - segment.end.x * segment.start.y) / 2;
    if (segment.kind === 'arc') {
      const start = Math.atan2(segment.start.y - segment.center.y, segment.start.x - segment.center.x);
      const end = Math.atan2(segment.end.y - segment.center.y, segment.end.x - segment.center.x);
      let sweep = end - start;
      if (segment.ccw) { while (sweep <= 0) sweep += Math.PI * 2; }
      else { while (sweep >= 0) sweep -= Math.PI * 2; }
      area += segment.radius ** 2 * (sweep - Math.sin(sweep)) / 2;
    }
  }
  return area;
}

/**
 * 010-E2 conservative eligibility only. A single uniform radius is reduced to
 * the tightest arc bending toward the free side. No global path clearance proof.
 */
export function assessTrochoidalGuideEligibility(
  guide: TrochoidalContourGuide,
  requestedRadiusMm: number,
  forwardStepMm: number,
  minimumRadiusMm = 0.25
): TrochoidalGuideEligibility {
  const fail = (message: string, index: number | null = null): TrochoidalGuideEligibility =>
    ({ ok: false, freeSide: null, uniformRadiusMm: null, reduced: false, limitingSegmentIndex: index, errors: [message] });
  if (!guide || !guide.validation?.ok || !Array.isArray(guide.source) || !Array.isArray(guide.segments)
    || (guide.side !== 'inside' && guide.side !== 'outside')
    || !Number.isFinite(guide.signedOffsetMm)
    || (guide.side === 'outside' ? guide.signedOffsetMm <= 0 : guide.signedOffsetMm >= 0))
    return fail('Keine gültige 010-B-Führung mit eindeutiger Bearbeitungsseite.');
  if (!Number.isFinite(requestedRadiusMm) || requestedRadiusMm <= 0
    || !Number.isFinite(forwardStepMm) || forwardStepMm <= 0
    || !Number.isFinite(minimumRadiusMm) || minimumRadiusMm <= 0)
    return fail('Radius, Fortschritt und Mindestradius müssen endlich und positiv sein.');
  const measured = measureSemanticGuide(guide.segments);
  if (!measured.ok || !measured.metric.closed)
    return fail(measured.ok ? '010-E2 benötigt eine geschlossene Führung.' : measured.errors[0]);
  const sourceArea = signedArea(guide.source), guideArea = signedArea(guide.segments);
  if (!Number.isFinite(sourceArea) || !Number.isFinite(guideArea) || Math.abs(sourceArea) <= 1e-9
    || Math.sign(sourceArea) !== Math.sign(guideArea))
    return fail('Konturorientierung ist nicht eindeutig erhalten.');
  const interiorSide = sourceArea > 0 ? 'left' : 'right';
  const freeSide = guide.side === 'inside' ? interiorSide : interiorSide === 'left' ? 'right' : 'left';

  let radius = requestedRadiusMm, limitingSegmentIndex: number | null = null;
  guide.segments.forEach((segment, index) => {
    if (segment.kind !== 'arc') return;
    const bendsTowardFreeSide = segment.ccw ? freeSide === 'left' : freeSide === 'right';
    if (bendsTowardFreeSide && segment.radius < radius) {
      radius = segment.radius;
      limitingSegmentIndex = index;
    }
  });
  if (radius < minimumRadiusMm)
    return fail(`Lokaler Führungsradius ${radius.toFixed(3)} mm unterschreitet den Mindestradius.`, limitingSegmentIndex);
  if (forwardStepMm > 2 * radius)
    return fail('Fortschritt überschreitet den Durchmesser der lokal begrenzten Schleife.', limitingSegmentIndex);
  return { ok: true, freeSide, uniformRadiusMm: radius, reduced: radius < requestedRadiusMm,
    limitingSegmentIndex, errors: [] };
}
