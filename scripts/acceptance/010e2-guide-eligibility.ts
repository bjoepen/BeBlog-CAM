import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import { assessTrochoidalGuideEligibility } from '../../src/lib/trochoidalGuideEligibility';
import type { Curve2 } from '../../src/lib/types';

const near = (a: number, b: number) => { if (Math.abs(a - b) > 1e-6) throw new Error(`${a} != ${b}`); };
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const operation = { ...defaultTrochoidalContourContract, contourId: 0 };
const capsule: Curve2[] = [{ kind: 'polyline', closed: true,
  points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }],
  bulges: [0, 1, 0, 1] }];
const outer = buildTrochoidalContourGuide(capsule, operation);
expect(outer.ok, `real 010-B outer capsule: ${outer.errors.join('; ')}`);
if (outer.ok) {
  const eligibility = assessTrochoidalGuideEligibility(outer.guide, 4, 2);
  expect(eligibility.ok, `outer eligibility: ${eligibility.errors.join('; ')}`);
  if (eligibility.ok) {
    expect(eligibility.freeSide === 'right', 'CCW outside free side');
    near(eligibility.uniformRadiusMm, 4);
    expect(!eligibility.reduced, 'outside radius unchanged');
  }
}
const inner = buildTrochoidalContourGuide(capsule, { ...operation, side: 'inside' });
expect(inner.ok, `real 010-B inner capsule: ${inner.errors.join('; ')}`);
if (inner.ok) {
  const eligibility = assessTrochoidalGuideEligibility(inner.guide, 4, 2);
  expect(eligibility.ok, `inner eligibility: ${eligibility.errors.join('; ')}`);
  if (eligibility.ok) {
    expect(eligibility.freeSide === 'left', 'CCW inside free side');
    near(eligibility.uniformRadiusMm, 1.8);
    expect(eligibility.reduced && eligibility.limitingSegmentIndex !== null, 'inner arc limits radius');
  }
  expect(!assessTrochoidalGuideEligibility(inner.guide, 4, 4).ok, 'step incompatible with reduced radius');
  expect(!assessTrochoidalGuideEligibility(inner.guide, 4, 2, 2).ok, 'minimum radius threshold');
}
const clockwise: Curve2[] = [{ kind: 'polyline', closed: true,
  points: [{ x: 0, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 0 }, { x: 0, y: 0 }],
  bulges: [0, -1, 0, -1] }];
const clockwiseGuide = buildTrochoidalContourGuide(clockwise, operation);
expect(clockwiseGuide.ok, `clockwise capsule offset: ${clockwiseGuide.errors.join('; ')}`);
if (clockwiseGuide.ok) {
  const eligibility = assessTrochoidalGuideEligibility(clockwiseGuide.guide, 4, 2);
  expect(eligibility.ok && eligibility.freeSide === 'left', 'CW outside free side reverses');
}
const rectangle: Curve2[] = [{ kind: 'polyline', closed: true,
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] }];
const sharp = buildTrochoidalContourGuide(rectangle, operation);
expect(sharp.ok, '010-B may build a sharp rectangle guide');
if (sharp.ok) expect(!assessTrochoidalGuideEligibility(sharp.guide, 4, 2).ok, '010-E2 rejects G0 corners');
const narrow: Curve2[] = [{ kind: 'polyline', closed: true,
  points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6.8 }, { x: 0, y: 6.8 }],
  bulges: [0, 1, 0, 1] }];
const narrowGuide = buildTrochoidalContourGuide(narrow, { ...operation, side: 'inside' });
expect(narrowGuide.ok, `narrow offset builds: ${narrowGuide.errors.join('; ')}`);
if (narrowGuide.ok) expect(!assessTrochoidalGuideEligibility(narrowGuide.guide, 4, .3).ok, 'too-tight inner arc fails below minimum');
console.log('010-E2 guide curvature eligibility: PASS');
