import type { Curve2 } from './types';
import { buildSemanticContours, offsetSemanticContour, type P2, type SemanticContour, type SemanticSegment, type OffsetValidation } from './contourMath';
import { validateTrochoidalContourContract, type TrochoidalContourContract } from './trochoidalContourContract';
import { buildRoundedRectangleOutsideOffset } from './trochoidalRoundedRectangle';

/** 010-B only: semantic cutter-center guide. This is not a machining clearance proof. */
export type TrochoidalContourGuide = {
  contourId: number;
  side: 'inside' | 'outside';
  /** Positive means outward from the enclosed design contour. */
  signedOffsetMm: number;
  source: SemanticSegment[];
  segments: SemanticSegment[];
  validation: OffsetValidation;
};

export type TrochoidalGuideResult =
  | { ok: true; guide: TrochoidalContourGuide; errors: [] }
  | { ok: false; guide: null; errors: string[] };

const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p: P2) => Number.isFinite(p.x) && Number.isFinite(p.y);
const CONNECT_TOLERANCE_MM = 1e-6;

function nativeCircle(curves: Curve2[], id: number, transform: (point: P2) => P2): Extract<Curve2, {kind:'circle'}> | null {
  let closedId = 0;
  for (const curve of curves) {
    if (curve.kind === 'circle') {
      if (closedId === id) return curve;
      closedId++;
    } else if (curve.kind === 'polyline' && curve.closed && buildSemanticContours([curve], transform).length) closedId++;
  }
  return null;
}

function circleSegments(center: P2, radius: number, east: P2, ccw: boolean): SemanticSegment[] {
  const west = { x: 2 * center.x - east.x, y: 2 * center.y - east.y };
  return [
    { kind: 'arc', start: east, end: west, center, radius, ccw },
    { kind: 'arc', start: west, end: east, center, radius, ccw }
  ];
}

/** Exact signed area for LINE/ARC boundaries (Green's theorem). */
function signedArea(segments: SemanticSegment[]): number {
  return segments.reduce((area, segment) => {
    const chord = (segment.start.x * segment.end.y - segment.end.x * segment.start.y) / 2;
    if (segment.kind === 'line') return area + chord;
    const start = Math.atan2(segment.start.y - segment.center.y, segment.start.x - segment.center.x);
    const end = Math.atan2(segment.end.y - segment.center.y, segment.end.x - segment.center.x);
    let sweep = end - start;
    if (segment.ccw) { while (sweep <= 0) sweep += Math.PI * 2; }
    else { while (sweep >= 0) sweep -= Math.PI * 2; }
    return area + chord + segment.radius ** 2 * (sweep - Math.sin(sweep)) / 2;
  }, 0);
}

function validClosedSemantic(contour: SemanticContour): boolean {
  const segments = contour.segments;
  if (!contour.supported || segments.length < 2) return false;
  return segments.every((segment, index) => {
    if (!finite(segment.start) || !finite(segment.end)) return false;
    if (distance(segment.end, segments[(index + 1) % segments.length].start) > CONNECT_TOLERANCE_MM) return false;
    if (segment.kind === 'line') return distance(segment.start, segment.end) > CONNECT_TOLERANCE_MM;
    return finite(segment.center) && Number.isFinite(segment.radius) && segment.radius > 0
      && Math.abs(distance(segment.start, segment.center) - segment.radius) <= CONNECT_TOLERANCE_MM
      && Math.abs(distance(segment.end, segment.center) - segment.radius) <= CONNECT_TOLERANCE_MM;
  });
}

export function buildTrochoidalContourGuide(
  curves: Curve2[], operation: TrochoidalContourContract, transform: (point: P2) => P2 = point => point
): TrochoidalGuideResult {
  const contract = validateTrochoidalContourContract(operation);
  if (!contract.ok) return { ok: false, guide: null, errors: contract.errors };
  if (!Array.isArray(curves)) return { ok: false, guide: null, errors: ['DXF-Konturgeometrie fehlt.'] };
  const circle = nativeCircle(curves, operation.contourId!, transform);
  const radius = operation.tool.diameterMm / 2;
  const offset = (operation.side === 'outside' ? 1 : -1) * (radius + operation.radialAllowanceMm);
  if (circle) {
    if (!finite(circle.center) || !Number.isFinite(circle.radius) || circle.radius <= 0)
      return { ok: false, guide: null, errors: ['DXF-Kreis hat ungültigen Mittelpunkt oder Radius.'] };
    const center = transform(circle.center);
    const east = transform({ x: circle.center.x + circle.radius, y: circle.center.y });
    const north = transform({ x: circle.center.x, y: circle.center.y + circle.radius });
    const dx = east.x - center.x, dy = east.y - center.y;
    const nx = north.x - center.x, ny = north.y - center.y;
    const sourceRadius = Math.hypot(dx, dy), transformedNorth = Math.hypot(nx, ny);
    const determinant = dx * ny - dy * nx;
    const samplesMatch = [Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI,
      5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4].every(angle => {
      const actual = transform({ x: circle.center.x + circle.radius * Math.cos(angle),
        y: circle.center.y + circle.radius * Math.sin(angle) });
      return finite(actual) && distance(actual, { x: center.x + dx * Math.cos(angle) + nx * Math.sin(angle),
        y: center.y + dy * Math.cos(angle) + ny * Math.sin(angle) }) <= CONNECT_TOLERANCE_MM;
    });
    if (!finite(center) || !finite(east) || !finite(north)
      || sourceRadius <= CONNECT_TOLERANCE_MM || Math.abs(sourceRadius - transformedNorth) > CONNECT_TOLERANCE_MM
      || Math.abs(dx * nx + dy * ny) > CONNECT_TOLERANCE_MM * sourceRadius
      || Math.abs(determinant) <= CONNECT_TOLERANCE_MM * sourceRadius || !samplesMatch)
      return { ok: false, guide: null, errors: ['DXF-Kreis benötigt eine endliche, kreistreue Ähnlichkeitstransformation.'] };
    const guideRadius = sourceRadius + offset;
    if (guideRadius <= CONNECT_TOLERANCE_MM)
      return { ok: false, guide: null, errors: ['Kreis-Offset kollabiert oder kehrt die Innenseite um.'] };
    const ccw = determinant > 0;
    const source = circleSegments(center, sourceRadius, east, ccw);
    const guideEast = { x: center.x + dx * guideRadius / sourceRadius, y: center.y + dy * guideRadius / sourceRadius };
    const segments = circleSegments(center, guideRadius, guideEast, ccw);
    return { ok: true, errors: [], guide: {
      contourId: operation.contourId!, side: operation.side, signedOffsetMm: offset, source, segments,
      validation: { ok: true, expectedMm: Math.abs(offset), measuredMinMm: Math.abs(offset),
        measuredMaxMm: Math.abs(offset), maxDeviationMm: 0, maxParallelError: 0, segmentCount: 2, sideOk: true }
    } };
  }
  const contour = buildSemanticContours(curves, transform).find(candidate => candidate.id === operation.contourId);
  if (!contour || !validClosedSemantic(contour))
    return { ok: false, guide: null, errors: ['Gewählte Kontur ist keine eindeutig geschlossene, stetige DXF-Linien-/Bogenkontur.'] };
  const sourceArea = signedArea(contour.segments);
  if (!Number.isFinite(sourceArea) || Math.abs(sourceArea) <= 1e-9)
    return { ok: false, guide: null, errors: ['Sollkontur hat keine gültige eingeschlossene Fläche.'] };

  const roundedRectangle=operation.side==='outside'
    ?buildRoundedRectangleOutsideOffset(contour.segments,Math.abs(offset)):null;
  const result = roundedRectangle??offsetSemanticContour(contour, offset, .002);
  if (!result || !result.validation.ok || !validClosedSemantic({ ...contour, segments: result.segments }))
    return { ok: false, guide: null, errors: ['Analytische Werkzeugmittelpunkt-Führung ist nicht geschlossen oder hat die Offset-Prüfung nicht bestanden.'] };
  const guideArea = signedArea(result.segments);
  if (!Number.isFinite(guideArea) || Math.sign(guideArea) !== Math.sign(sourceArea)
    || Math.abs(guideArea) <= 1e-9
    || (operation.side === 'outside' && Math.abs(guideArea) <= Math.abs(sourceArea))
    || (operation.side === 'inside' && Math.abs(guideArea) >= Math.abs(sourceArea)))
    return { ok: false, guide: null, errors: ['Offset-Führung hat die Flächen-/Orientierungsprüfung nicht bestanden.'] };

  return { ok: true, errors: [], guide: {
    contourId: contour.id, side: operation.side, signedOffsetMm: offset,
    source: contour.segments, segments: result.segments, validation: result.validation
  } };
}
