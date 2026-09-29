import type { P2, SemanticSegment } from './contourMath';

export type UncutStockWitness =
  | { status: 'witness'; firstStartFullDiskInStock: boolean; firstLinkVirginPoint: P2;
      firstLinkVirginMarginMm: number; errors: [] }
  | { status: 'unproven'; firstStartFullDiskInStock: false; firstLinkVirginPoint: null;
      firstLinkVirginMarginMm: null; errors: string[] };

const EPS = 1e-7;
const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p: P2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * 010-E5A: a negative witness under an explicitly uncut stock half-plane.
 * It never returns a manufacturing clearance or engagement certificate.
 */
export function witnessFirstApexLinkUncutStock(
  guide: Extract<SemanticSegment, { kind: 'line' }>,
  candidate: SemanticSegment[], cutterRadiusMm: number, freeSide: 'left' | 'right'
): UncutStockWitness {
  const unproven = (reason: string): UncutStockWitness => ({ status: 'unproven',
    firstStartFullDiskInStock: false, firstLinkVirginPoint: null, firstLinkVirginMarginMm: null, errors: [reason] });
  if (!guide || guide.kind !== 'line' || !finite(guide.start) || !finite(guide.end)
    || !Number.isFinite(cutterRadiusMm) || cutterRadiusMm <= 0
    || (freeSide !== 'left' && freeSide !== 'right') || !Array.isArray(candidate) || candidate.length < 3)
    return unproven('Führung, Werkzeug oder erste Schleife mit Verbindungsweg fehlt.');
  const [first, second, link] = candidate;
  if (first.kind !== 'arc' || second.kind !== 'arc' || link.kind !== 'line')
    return unproven('Erste Bahn ist keine Zweibogen-Schleife mit Apex-Verbindung.');
  const length = distance(guide.start, guide.end);
  if (!Number.isFinite(length) || length <= EPS || !finite(first.center) || !finite(first.start)
    || !finite(first.end) || !finite(second.center) || !finite(second.start)
    || !finite(second.end) || !finite(link.start) || !finite(link.end)
    || !Number.isFinite(first.radius) || first.radius <= EPS || !Number.isFinite(second.radius)
    || first.ccw !== second.ccw || typeof first.ccw !== 'boolean'
    || distance(first.center, second.center) > EPS || Math.abs(first.radius - second.radius) > EPS
    || distance(first.start, second.end) > EPS || distance(first.end, second.start) > EPS
    || Math.abs(distance(first.start, first.center) - first.radius) > EPS
    || Math.abs(distance(first.end, first.center) - first.radius) > EPS
    || Math.abs(distance(second.start, second.center) - second.radius) > EPS
    || Math.abs(distance(second.end, second.center) - second.radius) > EPS
    || Math.abs(distance(first.start, first.end) - 2 * first.radius) > EPS
    || distance(link.start, first.start) > EPS)
    return unproven('Erste Schleife ist kein gültiger geschlossener Kreis am Apex.');

  const tx = (guide.end.x - guide.start.x) / length, ty = (guide.end.y - guide.start.y) / length;
  const sign = freeSide === 'left' ? 1 : -1;
  const normal = { x: -ty * sign, y: tx * sign };
  const longitudinal = (p: P2) => (p.x - guide.start.x) * tx + (p.y - guide.start.y) * ty;
  const stockDistance = (p: P2) => (p.x - guide.start.x) * normal.x + (p.y - guide.start.y) * normal.y;
  const step = longitudinal(link.end) - longitudinal(link.start);
  if (Math.abs(stockDistance(first.end)) > EPS || stockDistance(first.start) <= EPS
    || Math.abs(stockDistance(link.end) - stockDistance(link.start)) > EPS
    || !Number.isFinite(step) || step <= EPS)
    return unproven('Apex-Link liegt nicht vorwärts auf einer parallelen Linie im Material-Halbraum.');

  // The preceding two semicircles cover a complete circle. Its cutter sweep is
  // exactly the cutter-radius neighbourhood of that circle, including both endpoints.
  const midpoint = { x: (link.start.x + link.end.x) / 2, y: (link.start.y + link.end.y) / 2 };
  const outer = { x: midpoint.x + normal.x * cutterRadiusMm, y: midpoint.y + normal.y * cutterRadiusMm };
  const outerMargin = Math.abs(distance(outer, first.center) - first.radius) - cutterRadiusMm;
  if (!Number.isFinite(outerMargin) || outerMargin <= 2 * EPS)
    return unproven('Kein hinreichend getrennter Neumaterial-Zeuge am ersten Apex-Link.');
  const inset = Math.min(cutterRadiusMm / 2, outerMargin / 2);
  const point = { x: outer.x - normal.x * inset, y: outer.y - normal.y * inset };
  const margin = Math.abs(distance(point, first.center) - first.radius) - cutterRadiusMm;
  if (stockDistance(point) <= EPS || margin <= EPS || !Number.isFinite(margin))
    return unproven('Zeugenpunkt ist nicht sicher im ungefrästen Material.');
  return { status: 'witness', firstStartFullDiskInStock: stockDistance(first.start) >= cutterRadiusMm + EPS,
    firstLinkVirginPoint: point, firstLinkVirginMarginMm: margin, errors: [] };
}
