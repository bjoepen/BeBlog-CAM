import { buildStraightTrochoid } from '../../src/lib/trochoidalStraightMath';
import { witnessFirstApexLinkUncutStock } from '../../src/lib/trochoidalUncutStockWitness';
import type { SemanticSegment } from '../../src/lib/contourMath';

const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const guide: Extract<SemanticSegment, {kind:'line'}> = {
  kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }
};
for (const side of ['left', 'right'] as const) {
  for (const direction of ['cw', 'ccw'] as const) {
    const path = buildStraightTrochoid(guide, { radiusMm: 4, forwardStepMm: 2,
      freeSide: side, loopDirection: direction });
    expect(path.ok, 'reference path exists');
    if (!path.ok) continue;
    const result = witnessFirstApexLinkUncutStock(guide, path.segments, 3, side);
    expect(result.status === 'witness', `uncut stock witness: ${result.errors.join('; ')}`);
    if (result.status === 'witness') {
      expect(result.firstStartFullDiskInStock, 'first cutter disk is completely in assumed stock');
      expect(result.firstLinkVirginMarginMm > 0, 'first link has previously uncut interior point');
      expect(Math.abs(result.firstLinkVirginPoint.x - 1) < 1e-6, 'link midpoint station');
      expect(side === 'left' ? result.firstLinkVirginPoint.y > 8 : result.firstLinkVirginPoint.y < -8,
        'witness is on the stock side');
    }
    expect(witnessFirstApexLinkUncutStock(guide, path.segments, 3, side === 'left' ? 'right' : 'left').status === 'unproven',
      'wrong stock side cannot inherit witness');
    expect(witnessFirstApexLinkUncutStock(guide, path.segments.slice(0, 2), 3, side).status === 'unproven',
      'missing link fails closed');
    expect(witnessFirstApexLinkUncutStock(guide, path.segments, NaN, side).status === 'unproven',
      'invalid tool fails closed');
    const broken: SemanticSegment[] = [...path.segments];
    broken[2] = { kind: 'line', start: path.segments[2].start, end: { x: 2, y: 5 } };
    expect(witnessFirstApexLinkUncutStock(guide, broken, 3, side).status === 'unproven',
      'non-parallel link fails closed');
  }
}
const rotatedGuide: typeof guide = { kind: 'line', start: { x: 10, y: 5 }, end: { x: 10, y: 105 } };
const rotated = buildStraightTrochoid(rotatedGuide, { radiusMm: 4, forwardStepMm: 2,
  freeSide: 'left', loopDirection: 'ccw' });
expect(rotated.ok && witnessFirstApexLinkUncutStock(rotatedGuide, rotated.segments, 3, 'left').status === 'witness',
  'rotated geometry preserves exact witness');
console.log('010-E5A uncut stock witness: PASS');
