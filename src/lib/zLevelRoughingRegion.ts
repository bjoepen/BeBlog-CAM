import type { ZLevelChain, ZPoint2 } from './zLevelSlice';

export type RoughingLoop = {
  points: ZPoint2[];
  role: 'stock' | 'part-boundary';
};

export type ZLevelRoughingRegion = {
  z: number;
  loops: RoughingLoop[];
};

const EPS = 1e-7;

function same2(a: ZPoint2, b: ZPoint2) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= EPS;
}

function close(points: ZPoint2[]): ZPoint2[] {
  if (points.length < 3) return [];
  const result = points.map((point) => ({ ...point }));
  if (!same2(result[0], result[result.length - 1])) result.push({ ...result[0] });
  return result;
}

/**
 * Builds the planar material region for one roughing level.
 *
 * Semantics are deliberately explicit:
 *   stock section MINUS complete part section
 *
 * The result is represented as an even/odd loop set. The stock loop is the
 * outer material domain; every closed BRep section chain toggles material
 * membership. This preserves islands and through-holes without pretending
 * that the returned loops are already cutter-centre paths.
 */
export function buildZLevelRoughingRegion(
  z: number,
  stockWidth: number,
  stockHeight: number,
  partChains: ZLevelChain[],
): ZLevelRoughingRegion | null {
  if (!(stockWidth > 0) || !(stockHeight > 0) || !Number.isFinite(z)) return null;

  const stock = close([
    { x: 0, y: 0 },
    { x: stockWidth, y: 0 },
    { x: stockWidth, y: stockHeight },
    { x: 0, y: stockHeight },
  ]);

  const boundaries = partChains
    .filter((chain) => chain.closed && chain.points.length >= 4)
    .map((chain) => close(chain.points))
    .filter((points) => points.length >= 4)
    .map((points) => ({ points, role: 'part-boundary' as const }));

  return {
    z,
    loops: [{ points: stock, role: 'stock' }, ...boundaries],
  };
}

export function roughingRegionContains(region: ZLevelRoughingRegion, point: ZPoint2): boolean {
  let inside = false;
  for (const loop of region.loops) {
    const polygon = loop.points;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      const crosses =
        (a.y > point.y) !== (b.y > point.y) &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x;
      if (crosses) inside = !inside;
    }
  }
  return inside;
}
