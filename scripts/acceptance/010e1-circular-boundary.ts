import { proveCircularGuideBoundary } from '../../src/lib/trochoidalCircularBoundary';
import { buildSemanticTrochoid } from '../../src/lib/trochoidalSemanticMath';
import type { SemanticSegment } from '../../src/lib/contourMath';

const near = (a: number, b: number) => { if (Math.abs(a - b) > 1e-6) throw new Error(`${a} != ${b}`); };
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const center = { x: 0, y: 0 }, guideRadius = 10;
const circle: SemanticSegment[] = [
  { kind: 'arc', start: { x: 10, y: 0 }, end: { x: -10, y: 0 }, center, radius: 10, ccw: true },
  { kind: 'arc', start: { x: -10, y: 0 }, end: { x: 10, y: 0 }, center, radius: 10, ccw: true }
];
const make = (radiusMm: number, forwardStepMm: number, freeSide: 'left' | 'right') =>
  buildSemanticTrochoid(circle, { radiusMm, forwardStepMm, freeSide, loopDirection: 'ccw' });

const outside = make(4, 4, 'right');
expect(outside.ok, 'outside reference generated');
if (outside.ok) {
  const proof = proveCircularGuideBoundary({ center, radiusMm: guideRadius, side: 'outside' }, outside.segments);
  expect(proof.ok, `outside bound: ${proof.errors.join('; ')}`);
  near(proof.measuredMinRadiusMm, guideRadius);
  expect(proof.measuredMaxRadiusMm > guideRadius, 'outside motion uses free side');
  expect(!proveCircularGuideBoundary({ center, radiusMm: guideRadius, side: 'inside' }, outside.segments).ok, 'wrong side rejected');
}
const inside = make(4, 4, 'left');
expect(inside.ok, 'inside reference generated');
if (inside.ok) {
  const proof = proveCircularGuideBoundary({ center, radiusMm: guideRadius, side: 'inside' }, inside.segments);
  expect(proof.ok, `inside bound: ${proof.errors.join('; ')}`);
  near(proof.measuredMaxRadiusMm, guideRadius);
}

const oversizedInside = make(16, 20, 'left');
expect(oversizedInside.ok, 'oversized candidate exists before proof');
if (oversizedInside.ok)
  expect(!proveCircularGuideBoundary({ center, radiusMm: guideRadius, side: 'inside' }, oversizedInside.segments).ok,
    'large inner loop crosses protected side');

const crossingLink = make(16, 32, 'right');
expect(crossingLink.ok && crossingLink.loopCount === 2, 'two-loop outside candidate');
if (crossingLink.ok) {
  const proof = proveCircularGuideBoundary({ center, radiusMm: guideRadius, side: 'outside' }, crossingLink.segments);
  expect(!proof.ok && proof.failingSegmentIndex !== null
    && crossingLink.segments[proof.failingSegmentIndex].kind === 'line', 'free-side endpoints do not prove a safe link');
}

const chord: SemanticSegment[] = [
  { kind: 'line', start: { x: -20, y: 0 }, end: { x: 20, y: 0 } },
  { kind: 'line', start: { x: 20, y: 0 }, end: { x: -20, y: 0 } }
];
expect(!proveCircularGuideBoundary({ center, radiusMm: 10, side: 'outside' }, chord).ok,
  'line endpoints outside do not excuse an interior crossing');
const inwardArc: SemanticSegment[] = [
  { kind: 'arc', start: { x: 20, y: 10 }, end: { x: 20, y: -10 }, center: { x: 20, y: 0 }, radius: 10, ccw: true },
  { kind: 'line', start: { x: 20, y: -10 }, end: { x: 20, y: 10 } }
];
expect(!proveCircularGuideBoundary({ center, radiusMm: 15, side: 'outside' }, inwardArc).ok,
  'arc extrema between safe endpoints must be detected');
expect(!proveCircularGuideBoundary({ center, radiusMm: 0, side: 'outside' }, circle).ok, 'invalid guide');
expect(!proveCircularGuideBoundary({ center, radiusMm: 10, side: 'outside' }, [circle[0]]).ok, 'open candidate');
console.log('010-E1 circular boundary proof: PASS');
