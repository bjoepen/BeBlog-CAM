import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import { assessTrochoidalGuideEligibility } from '../../src/lib/trochoidalGuideEligibility';
import { buildSemanticTrochoid } from '../../src/lib/trochoidalSemanticMath';
import { proveCapsuleGuideBoundary } from '../../src/lib/trochoidalCapsuleBoundary';
import type { SemanticSegment } from '../../src/lib/contourMath';
import type { Curve2 } from '../../src/lib/types';

const near = (a: number, b: number) => { if (Math.abs(a - b) > 1e-6) throw new Error(`${a} != ${b}`); };
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const capsule: Curve2[] = [{ kind: 'polyline', closed: true,
  points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }],
  bulges: [0, 1, 0, 1] }];
const operation = { ...defaultTrochoidalContourContract, contourId: 0 };
for (const side of ['outside', 'inside'] as const) {
  const guide = buildTrochoidalContourGuide(capsule, { ...operation, side });
  expect(guide.ok, `real 010-B ${side} capsule: ${guide.errors.join('; ')}`);
  if (!guide.ok) continue;
  const eligibility = assessTrochoidalGuideEligibility(guide.guide, 4, 1);
  expect(eligibility.ok, `010-E2 ${side}: ${eligibility.errors.join('; ')}`);
  if (!eligibility.ok) continue;
  const candidate = buildSemanticTrochoid(guide.guide.segments, {
    radiusMm: eligibility.uniformRadiusMm, forwardStepMm: 1,
    freeSide: eligibility.freeSide, loopDirection: 'ccw'
  });
  expect(candidate.ok, `010-D ${side}: ${candidate.errors.join('; ')}`);
  if (!candidate.ok) continue;
  const proof = proveCapsuleGuideBoundary(guide.guide, candidate.segments);
  expect(proof.ok, `010-E3 ${side}: ${proof.errors.join('; ')} at ${proof.failingSegmentIndex}`);
  if (side === 'outside') near(proof.measuredMinDistanceMm, 8.2);
  else near(proof.measuredMaxDistanceMm, 1.8);
}

const rotated = buildTrochoidalContourGuide(capsule, operation, p => {
  const angle = 37 * Math.PI / 180;
  return { x: 50 + p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: -20 + p.x * Math.sin(angle) + p.y * Math.cos(angle) };
});
expect(rotated.ok, `rotated capsule guide: ${rotated.errors.join('; ')}`);
if (rotated.ok) {
  const choice = assessTrochoidalGuideEligibility(rotated.guide, 4, 1);
  expect(choice.ok, 'rotated eligibility');
  if (choice.ok) {
    const path = buildSemanticTrochoid(rotated.guide.segments, { radiusMm: choice.uniformRadiusMm,
      forwardStepMm: 1, freeSide: choice.freeSide, loopDirection: 'cw' });
    expect(path.ok && proveCapsuleGuideBoundary(rotated.guide, path.segments).ok, 'rotated CW path stays outside');
  }
}
const reversed: Curve2[] = [{ kind: 'polyline', closed: true,
  points: [{ x: 0, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 0 }, { x: 0, y: 0 }],
  bulges: [0, -1, 0, -1] }];
const clockwiseGuide = buildTrochoidalContourGuide(reversed, operation);
expect(clockwiseGuide.ok, `CW capsule guide: ${clockwiseGuide.errors.join('; ')}`);
if (clockwiseGuide.ok) {
  const choice = assessTrochoidalGuideEligibility(clockwiseGuide.guide, 4, 1);
  expect(choice.ok, 'CW eligibility');
  if (choice.ok) {
    const path = buildSemanticTrochoid(clockwiseGuide.guide.segments, { radiusMm: choice.uniformRadiusMm,
      forwardStepMm: 1, freeSide: choice.freeSide, loopDirection: 'cw' });
    expect(path.ok && proveCapsuleGuideBoundary(clockwiseGuide.guide, path.segments).ok, 'CW contour stays outside');
  }
}

const outer = buildTrochoidalContourGuide(capsule, operation);
expect(outer.ok, 'outer capsule setup');
if (outer.ok) {
  const crossingChord: SemanticSegment[] = [
    { kind: 'line', start: { x: -20, y: 5 }, end: { x: 40, y: 5 } },
    { kind: 'line', start: { x: 40, y: 5 }, end: { x: -20, y: 5 } }
  ];
  expect(!proveCapsuleGuideBoundary(outer.guide, crossingChord).ok, 'safe endpoints do not prove line clearance');
  const crossingArc: SemanticSegment[] = [
    { kind: 'arc', start: { x: 30, y: 15 }, end: { x: 30, y: -5 }, center: { x: 30, y: 5 }, radius: 10, ccw: true },
    { kind: 'line', start: { x: 30, y: -5 }, end: { x: 30, y: 15 } }
  ];
  expect(!proveCapsuleGuideBoundary(outer.guide, crossingArc).ok, 'arc interior extremum must be checked');
  expect(!proveCapsuleGuideBoundary(outer.guide, [crossingArc[0]]).ok, 'open path must fail');
}
const rectangle: Curve2[] = [{ kind: 'polyline', closed: true,
  points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }] }];
const rectangleGuide = buildTrochoidalContourGuide(rectangle, operation);
expect(rectangleGuide.ok, '010-B rectangle setup');
if (rectangleGuide.ok) expect(!proveCapsuleGuideBoundary(rectangleGuide.guide, []).ok, 'unsupported rectangular guide');
console.log('010-E3 real capsule boundary proof: PASS');
