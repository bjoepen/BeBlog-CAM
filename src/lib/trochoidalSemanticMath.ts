import type { P2, SemanticSegment } from './contourMath';
import type { StraightTrochoidOptions } from './trochoidalStraightMath';

export type SemanticGuideStation = { point: P2; tangent: P2; segmentIndex: number };
export type SemanticGuideMetric = {
  segments: SemanticSegment[];
  lengthsMm: number[];
  totalLengthMm: number;
  closed: boolean;
};
export type SemanticGuideResult =
  | { ok: true; metric: SemanticGuideMetric; errors: [] }
  | { ok: false; metric: null; errors: string[] };
export type SemanticTrochoidResult =
  | { ok: true; segments: SemanticSegment[]; loopCount: number; guideLengthMm: number; closed: boolean; errors: [] }
  | { ok: false; segments: []; loopCount: 0; guideLengthMm: 0; closed: false; errors: string[] };

const EPS = 1e-6;
const MAX_LOOPS = 10000;
const finite = (p: P2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);
const normalised = (v: P2): P2 => { const length = Math.hypot(v.x, v.y); return { x: v.x / length, y: v.y / length }; };
const angle = (p: P2, center: P2) => Math.atan2(p.y - center.y, p.x - center.x);

function arcSweep(segment: Extract<SemanticSegment, { kind: 'arc' }>): number {
  let sweep = angle(segment.end, segment.center) - angle(segment.start, segment.center);
  if (segment.ccw) { while (sweep <= 0) sweep += 2 * Math.PI; }
  else { while (sweep >= 0) sweep -= 2 * Math.PI; }
  return sweep;
}

function segmentTangent(segment: SemanticSegment, atEnd: boolean): P2 {
  if (segment.kind === 'line') return normalised({ x: segment.end.x - segment.start.x, y: segment.end.y - segment.start.y });
  const point = atEnd ? segment.end : segment.start;
  const radial = normalised({ x: point.x - segment.center.x, y: point.y - segment.center.y });
  return segment.ccw ? { x: -radial.y, y: radial.x } : { x: radial.y, y: -radial.x };
}

/** Validate continuous, G1-tangent LINE/ARC geometry before arclength sampling. */
export function measureSemanticGuide(segments: SemanticSegment[]): SemanticGuideResult {
  const fail = (error: string): SemanticGuideResult => ({ ok: false, metric: null, errors: [error] });
  if (!Array.isArray(segments) || segments.length === 0) return fail('Semantische Führung enthält keine Segmente.');
  const lengthsMm: number[] = [];
  let totalLengthMm = 0;
  for (const [index, segment] of segments.entries()) {
    if (!segment || (segment.kind !== 'line' && segment.kind !== 'arc'))
      return fail(`Segment ${index + 1} hat einen unbekannten Typ.`);
    if (!finite(segment.start) || !finite(segment.end)) return fail(`Segment ${index + 1} enthält ungültige Punkte.`);
    let length: number;
    if (segment.kind === 'line') length = distance(segment.start, segment.end);
    else {
      if (!finite(segment.center) || typeof segment.ccw !== 'boolean' || !Number.isFinite(segment.radius) || segment.radius <= 0
        || Math.abs(distance(segment.start, segment.center) - segment.radius) > EPS
        || Math.abs(distance(segment.end, segment.center) - segment.radius) > EPS)
        return fail(`Segment ${index + 1} hat ungültige Bogenmaße.`);
      length = Math.abs(arcSweep(segment)) * segment.radius;
    }
    if (!Number.isFinite(length) || length <= EPS) return fail(`Segment ${index + 1} ist degeneriert.`);
    lengthsMm.push(length);
    totalLengthMm += length;
    if (!Number.isFinite(totalLengthMm)) return fail('Führungslänge ist ungültig.');
    if (index > 0) {
      const previous = segments[index - 1];
      if (distance(previous.end, segment.start) > EPS) return fail(`Lücke an Übergang ${index}.`);
      if (distance(segmentTangent(previous, true), segmentTangent(segment, false)) > EPS)
        return fail(`Scharfer oder gegenläufiger Übergang ${index} benötigt 010-E Eckprüfung.`);
    }
  }
  const closed = distance(segments[segments.length - 1].end, segments[0].start) <= EPS;
  if (closed && distance(segmentTangent(segments[segments.length - 1], true), segmentTangent(segments[0], false)) > EPS)
    return fail('Scharfe Schließnaht benötigt 010-E Eckprüfung.');
  return { ok: true, metric: { segments, lengthsMm, totalLengthMm, closed }, errors: [] };
}

/** Sample exact LINE/ARC primitives, never a tessellated display path. */
export function stationAtLength(metric: SemanticGuideMetric, distanceMm: number): SemanticGuideStation | null {
  if (!Number.isFinite(distanceMm) || distanceMm < 0 || distanceMm > metric.totalLengthMm) return null;
  let traversed = 0;
  for (let i = 0; i < metric.segments.length; i++) {
    const segment = metric.segments[i], length = metric.lengthsMm[i];
    if (distanceMm > traversed + length && i < metric.segments.length - 1) { traversed += length; continue; }
    const local = Math.min(length, Math.max(0, distanceMm - traversed));
    if (segment.kind === 'line') {
      const tangent = segmentTangent(segment, false);
      return { point: local === 0 ? segment.start : local === length ? segment.end
        : { x: segment.start.x + tangent.x * local, y: segment.start.y + tangent.y * local }, tangent, segmentIndex: i };
    }
    const a = angle(segment.start, segment.center) + arcSweep(segment) * local / length;
    const point = local === 0 ? segment.start : local === length ? segment.end
      : { x: segment.center.x + segment.radius * Math.cos(a), y: segment.center.y + segment.radius * Math.sin(a) };
    return { point, tangent: segment.ccw ? { x: -Math.sin(a), y: Math.cos(a) }
      : { x: Math.sin(a), y: -Math.cos(a) }, segmentIndex: i };
  }
  return null;
}

/** 010-D reference only: no global cutter-envelope, stock or engagement proof. */
export function buildSemanticTrochoid(guide: SemanticSegment[], options: StraightTrochoidOptions): SemanticTrochoidResult {
  const fail = (error: string): SemanticTrochoidResult =>
    ({ ok: false, segments: [], loopCount: 0, guideLengthMm: 0, closed: false, errors: [error] });
  const measured = measureSemanticGuide(guide);
  if (!measured.ok) return fail(measured.errors[0]);
  const { radiusMm: radius, forwardStepMm: step, freeSide, loopDirection } = options;
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(step) || step <= 0)
    return fail('Trochoidenradius und Fortschritt müssen endlich und positiv sein.');
  if (step > 2 * radius) return fail('Fortschritt überschreitet den Schleifendurchmesser.');
  if (freeSide !== 'left' && freeSide !== 'right') return fail('Ungültige Freiseite.');
  if (loopDirection !== 'cw' && loopDirection !== 'ccw') return fail('Ungültige Schleifenrichtung.');
  const sign = freeSide === 'left' ? 1 : -1;
  // The apex runs at twice the loop radius from the guide. On a curved guide
  // its arclength can therefore advance faster than the guide itself. Build
  // stations per native segment and cap the apex advance by forwardStepMm.
  const stationDistances:number[]=[0];
  let traversed=0;
  for(let i=0;i<metric.segments.length;i++){
    const segment=metric.segments[i],length=metric.lengthsMm[i];
    let localStep=step;
    if(segment.kind==='arc'){
      const bendsTowardFreeSide=segment.ccw?freeSide==='left':freeSide==='right';
      const apexRadius=bendsTowardFreeSide?segment.radius-2*radius:segment.radius+2*radius;
      if(apexRadius<=EPS)return fail(`Trochoiden-Apex kollabiert am Führungsbogen ${i+1}.`);
      localStep=Math.min(step,step*segment.radius/apexRadius);
    }
    const intervals=Math.max(1,Math.ceil(length/localStep));
    for(let j=1;j<=intervals;j++){
      const d=traversed+length*j/intervals;
      if(!metric.closed||d<metric.totalLengthMm-EPS)stationDistances.push(d);
    }
    traversed+=length;
  }
  if(metric.closed&&stationDistances.length<2)return fail('Geschlossene Führung benötigt mindestens zwei getrennte Schleifenstationen.');
  if(!metric.closed&&stationDistances[stationDistances.length-1]<metric.totalLengthMm-EPS)stationDistances.push(metric.totalLengthMm);
  const loopCount=stationDistances.length;
  if (loopCount > MAX_LOOPS) return fail('Zu viele Trochoidenschleifen.');
  const segments: SemanticSegment[] = [];
  let firstApex: P2 | null = null, previousApex: P2 | null = null;
  for (let i = 0; i < loopCount; i++) {
    const station = stationAtLength(metric, stationDistances[i]);
    if (!station) return fail('Bogenlängen-Station konnte nicht bestimmt werden.');
    const normal = { x: -station.tangent.y * sign, y: station.tangent.x * sign };
    const shifted = (amount: number): P2 => ({ x: station.point.x + normal.x * amount, y: station.point.y + normal.y * amount });
    const touch = station.point, center = shifted(radius), apex = shifted(2 * radius);
    if (!finite(center) || !finite(apex)) return fail('Trochoidenstation liegt außerhalb gültiger Koordinaten.');
    if (previousApex) segments.push({ kind: 'line', start: previousApex, end: apex });
    const ccw = loopDirection === 'ccw';
    segments.push({ kind: 'arc', start: apex, end: touch, center, radius, ccw });
    segments.push({ kind: 'arc', start: touch, end: apex, center, radius, ccw });
    firstApex ??= apex;
    previousApex = apex;
  }
  if (metric.closed && firstApex && previousApex)
    segments.push({ kind: 'line', start: previousApex, end: firstApex });
  return { ok: true, segments, loopCount, guideLengthMm: metric.totalLengthMm, closed: metric.closed, errors: [] };
}
