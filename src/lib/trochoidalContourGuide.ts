import type { Curve2 } from './types';
import { buildSemanticContours, offsetSemanticContour, type P2, type SemanticContour, type SemanticSegment, type OffsetValidation } from './contourMath';
import { validateTrochoidalContourContract, type TrochoidalContourContract } from './trochoidalContourContract';

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
  const contour = buildSemanticContours(curves, transform).find(candidate => candidate.id === operation.contourId);
  if (!contour || !validClosedSemantic(contour))
    return { ok: false, guide: null, errors: ['Gewählte Kontur ist keine eindeutig geschlossene, stetige DXF-Linien-/Bogenkontur.'] };
  const sourceArea = signedArea(contour.segments);
  if (!Number.isFinite(sourceArea) || Math.abs(sourceArea) <= 1e-9)
    return { ok: false, guide: null, errors: ['Sollkontur hat keine gültige eingeschlossene Fläche.'] };

  const radius = operation.tool.diameterMm / 2;
  const offset = (operation.side === 'outside' ? 1 : -1) * (radius + operation.radialAllowanceMm);
  const result = offsetSemanticContour(contour, offset, .002);
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
