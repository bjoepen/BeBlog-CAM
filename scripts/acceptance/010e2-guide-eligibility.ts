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
const roundedRectangle = buildTrochoidalContourGuide(rectangle, operation);
expect(roundedRectangle.ok, 'E7 may replace a rectangle outside miter with a bound tangent guide');
if (roundedRectangle.ok) {
  const eligibility=assessTrochoidalGuideEligibility(roundedRectangle.guide,4,2);
  expect(eligibility.ok,'E7 tangent rectangle guide is G1 eligible');
}
const rawSharpGuide = {
  contourId: 0, side: 'outside' as const, signedOffsetMm: 3.2,
  source: [
    {kind:'line' as const,start:{x:0,y:0},end:{x:100,y:0}},
    {kind:'line' as const,start:{x:100,y:0},end:{x:100,y:50}},
    {kind:'line' as const,start:{x:100,y:50},end:{x:0,y:50}},
    {kind:'line' as const,start:{x:0,y:50},end:{x:0,y:0}}
  ],
  segments: [
    {kind:'line' as const,start:{x:-3.2,y:-3.2},end:{x:103.2,y:-3.2}},
    {kind:'line' as const,start:{x:103.2,y:-3.2},end:{x:103.2,y:53.2}},
    {kind:'line' as const,start:{x:103.2,y:53.2},end:{x:-3.2,y:53.2}},
    {kind:'line' as const,start:{x:-3.2,y:53.2},end:{x:-3.2,y:-3.2}}
  ],
  validation:{ok:true,expectedMm:3.2,measuredMinMm:3.2,measuredMaxMm:3.2,maxDeviationMm:0,maxParallelError:0,segmentCount:4,sideOk:true}
};
expect(!assessTrochoidalGuideEligibility(rawSharpGuide,4,2).ok,'010-E2 still rejects a raw G0 guide');
const narrow: Curve2[] = [{ kind: 'polyline', closed: true,
  points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6.8 }, { x: 0, y: 6.8 }],
  bulges: [0, 1, 0, 1] }];
const narrowGuide = buildTrochoidalContourGuide(narrow, { ...operation, side: 'inside' });
expect(narrowGuide.ok, `narrow offset builds: ${narrowGuide.errors.join('; ')}`);
if (narrowGuide.ok) expect(!assessTrochoidalGuideEligibility(narrowGuide.guide, 4, .3).ok, 'too-tight inner arc fails below minimum');
console.log('010-E2 guide curvature eligibility: PASS');
