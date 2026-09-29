import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import { assessTrochoidalGuideEligibility } from '../../src/lib/trochoidalGuideEligibility';
import { buildSemanticTrochoid } from '../../src/lib/trochoidalSemanticMath';
import { proveTrochoidalCircleGuideBoundary } from '../../src/lib/trochoidalCircularBoundary';
import type { Curve2 } from '../../src/lib/types';

const expect = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const near = (a: number, b: number) => expect(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const circle: Curve2 = { kind: 'circle', center: { x: 12, y: -7 }, radius: 20 };
const rectangle: Curve2 = { kind: 'polyline', closed: true, points: [
  { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }
] };
const op = { ...defaultTrochoidalContourContract, contourId: 1 };
for (const side of ['outside', 'inside'] as const) {
  for (const transform of [
    (p: {x:number;y:number}) => p,
    (p: {x:number;y:number}) => ({ x: -p.y + 50, y: p.x - 30 }),
    (p: {x:number;y:number}) => ({ x: -p.x + 50, y: p.y - 30 })
  ]) {
    const guide = buildTrochoidalContourGuide([rectangle, circle], { ...op, side }, transform);
    expect(guide.ok, `native circle ${side}: ${guide.errors.join('; ')}`);
    if (!guide.ok) continue;
    expect(guide.guide.contourId === 1 && guide.guide.segments.every(s => s.kind === 'arc'), 'selected circle preserved as two arcs');
    near((guide.guide.segments[0] as Extract<typeof guide.guide.segments[number],{kind:'arc'}>).radius, side === 'inside' ? 16.8 : 23.2);
    const eligibility = assessTrochoidalGuideEligibility(guide.guide, 4, 2);
    expect(eligibility.ok, `eligibility: ${eligibility.errors.join('; ')}`);
    if (!eligibility.ok) continue;
    const candidate = buildSemanticTrochoid(guide.guide.segments, {
      radiusMm: eligibility.uniformRadiusMm, forwardStepMm: 2, freeSide: eligibility.freeSide, loopDirection: 'ccw'
    });
    expect(candidate.ok, `candidate: ${candidate.errors.join('; ')}`);
    if (!candidate.ok) continue;
    const proof = proveTrochoidalCircleGuideBoundary(guide.guide, candidate.segments);
    expect(proof.ok, `circular boundary: ${proof.errors.join('; ')}`);
    const corrupted = { ...guide.guide, signedOffsetMm: -guide.guide.signedOffsetMm };
    expect(!proveTrochoidalCircleGuideBoundary(corrupted, candidate.segments).ok, 'forged offset fails');
    expect(!proveTrochoidalCircleGuideBoundary({ ...guide.guide,
      validation: { ...guide.guide.validation, expectedMm: NaN } }, candidate.segments).ok, 'nonfinite validation fails');
    const lineGuide = { ...guide.guide, segments: [
      { kind: 'line' as const, start: {x:0,y:0}, end: {x:1,y:0} }, guide.guide.segments[1]
    ] };
    expect(!proveTrochoidalCircleGuideBoundary(lineGuide, candidate.segments).ok, 'non-circle guide fails');
  }
}
const single = { ...op, contourId: 0 };
expect(buildTrochoidalContourGuide([circle, rectangle], single).ok, 'circle before polyline uses id zero');
expect(!buildTrochoidalContourGuide([circle], { ...single, side: 'inside', tool: { ...single.tool, diameterMm: 45 } }).ok, 'collapsed inside fails');
expect(!buildTrochoidalContourGuide([{ ...circle, radius: NaN }], single).ok, 'invalid radius fails');
expect(!buildTrochoidalContourGuide([circle], single, p => ({ x: p.x * 2, y: p.y })).ok, 'nonuniform scale fails');
expect(!buildTrochoidalContourGuide([circle], single, p => ({ x: p.x + (p.y + 7) ** 2 / 100, y: p.y })).ok, 'nonlinear distortion fails');
const valid = buildTrochoidalContourGuide([circle], single);
expect(valid.ok, 'valid circle');
if (valid.ok) {
  const radius = (valid.guide.segments[0] as Extract<typeof valid.guide.segments[number],{kind:'arc'}>).radius;
  const center = (valid.guide.segments[0] as Extract<typeof valid.guide.segments[number],{kind:'arc'}>).center;
  const chord = [
    { kind: 'line' as const, start: {x:center.x-radius-2,y:center.y}, end: {x:center.x+radius+2,y:center.y} },
    { kind: 'line' as const, start: {x:center.x+radius+2,y:center.y}, end: {x:center.x-radius-2,y:center.y} }
  ];
  expect(!proveTrochoidalCircleGuideBoundary(valid.guide, chord).ok, 'crossing link fails');
}
console.log('010-E4 native circle bridge: PASS');
