import { buildStraightTrochoid } from '../../src/lib/trochoidalStraightMath';
import { proveAssumedSeedClearance } from '../../src/lib/trochoidalSeedClearance';
import { witnessFirstApexLinkUncutStock } from '../../src/lib/trochoidalUncutStockWitness';
import type { SemanticSegment } from '../../src/lib/contourMath';

const expect = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const guide: Extract<SemanticSegment, {kind:'line'}> = {
  kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }
};
const candidate = buildStraightTrochoid(guide, { radiusMm: 4, forwardStepMm: 2,
  freeSide: 'left', loopDirection: 'ccw' });
expect(candidate.ok, 'straight reference exists');
if (candidate.ok) {
  const seed = candidate.segments.slice(0, 3);
  const cleared = { center: { x: 1, y: 4 }, radiusMm: 9, clearedToDepthMm: 2 };
  const proof = proveAssumedSeedClearance(cleared, seed, 3, 1);
  expect(proof.ok && proof.maxFootprintRadiusMm < 9, 'entire first loop and link fit assumed cleared cylinder');
  expect(witnessFirstApexLinkUncutStock(guide, candidate.segments, 3, 'left').status === 'witness',
    'without the cleared assumption, first link encounters virgin stock');
  expect(!proveAssumedSeedClearance({ ...cleared, radiusMm: 7 }, seed, 3, 1).ok,
    'undersized cleared cylinder fails');
  expect(!proveAssumedSeedClearance(cleared, seed, 3, 3).ok, 'insufficient cleared depth fails');
  expect(!proveAssumedSeedClearance(cleared, seed, 9, 1).ok, 'oversized cutter fails');
  expect(!proveAssumedSeedClearance(cleared, [], 3, 1).ok, 'missing path fails');
  const broken = [...seed];
  broken[2] = { kind: 'line', start: { x: 999, y: 8 }, end: seed[2].end };
  expect(!proveAssumedSeedClearance(cleared, broken, 3, 1).ok, 'gap fails');
  const invalid = [...seed];
  invalid[0] = { ...seed[0], radius: 5 } as SemanticSegment;
  expect(!proveAssumedSeedClearance(cleared, invalid, 3, 1).ok, 'invalid arc fails');
}
const arc: SemanticSegment[] = [
  { kind: 'arc', start: {x:-5,y:0}, end: {x:5,y:0}, center: {x:0,y:0}, radius:5, ccw:false }
];
expect(!proveAssumedSeedClearance({ center:{x:0,y:0}, radiusMm:7, clearedToDepthMm:2 }, arc, 2, 1).ok,
  'tangent is not a robust clearance margin');
const bulgingArc: SemanticSegment[] = [
  { kind: 'arc', start: {x:5,y:5}, end: {x:5,y:-5}, center: {x:5,y:0}, radius:5, ccw:false }
];
expect(!proveAssumedSeedClearance({ center:{x:0,y:0}, radiusMm:11.5, clearedToDepthMm:2 },
  bulgingArc, 2, 1).ok, 'interior radial maximum defeats safe-looking arc endpoints');
const nearlyConcentricFullArc: SemanticSegment[] = [
  { kind: 'arc', start: {x:-5+8e-8,y:0}, end: {x:-5+8e-8,y:0},
    center: {x:8e-8,y:0}, radius:5, ccw:true }
];
expect(!proveAssumedSeedClearance({ center:{x:0,y:0}, radiusMm:7+1.5e-7, clearedToDepthMm:2 },
  nearlyConcentricFullArc, 2, 1).ok, 'tiny center displacement retains its interior maximum');
console.log('010-E5B assumed seed clearance: PASS');
