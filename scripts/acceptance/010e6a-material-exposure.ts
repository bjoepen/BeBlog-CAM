import type { SemanticSegment } from '../../src/lib/contourMath';
import type { CanonicalToolpath } from '../../src/lib/canonicalToolpath';
import { boundMaterialExposureOutsideSeed } from '../../src/lib/trochoidalMaterialExposure';
import { constructAssumedDiskFromCanonicalRun } from '../../src/lib/trochoidalCanonicalSeed';
import { buildStraightTrochoid } from '../../src/lib/trochoidalStraightMath';
import { proveAssumedSeedClearance } from '../../src/lib/trochoidalSeedClearance';

const expect = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const line = (from: number, to: number): SemanticSegment =>
  ({ kind: 'line', start: {x:from,y:0}, end: {x:to,y:0} });
const seed = { center: {x:0,y:0}, radiusMm:10, clearedToDepthMm:2 };
const clear = boundMaterialExposureOutsideSeed(seed, [line(0, 1)], 2, 1, 0);
expect(clear.ok && clear.maxExposedAngleDeg === 0, 'fully cleared motion has zero exposure');
const partial = boundMaterialExposureOutsideSeed(seed, [line(8, 9)], 2, 1, 140);
const exact = 2 * Math.acos((100-81-4)/36) * 180 / Math.PI;
expect(partial.ok && partial.maxExposedAngleDeg !== null && partial.maxExposedAngleDeg >= exact
  && partial.maxExposedAngleDeg < exact + .001, 'analytic cap angle with conservative reserve');
const full = boundMaterialExposureOutsideSeed(seed, [line(8, 9), line(9, 13)], 2, 1, 140);
expect(!full.ok && full.maxExposedAngleDeg === 360 && full.firstLimitExceededSegmentIndex === 1
  && full.limitingSegmentIndex === 1, 'later complete immersion rejected');
const complete = boundMaterialExposureOutsideSeed(seed, [line(8, 9), line(9, 13)], 2, 1, 100);
expect(!complete.ok && complete.firstLimitExceededSegmentIndex === 0 && complete.maxExposedAngleDeg === 360,
  'continue measuring the whole valid path after first policy failure');
const bulge: SemanticSegment[] = [{ kind:'arc', start:{x:5,y:5}, end:{x:5,y:-5},
  center:{x:5,y:0}, radius:5, ccw:false }];
const arcProof = boundMaterialExposureOutsideSeed(seed, bulge, 2, 1, 170);
expect(!arcProof.ok && arcProof.maxExposedAngleDeg !== null && arcProof.maxExposedAngleDeg > 190,
  'interior arc extrema expose stock despite fully cleared endpoints');
const inwardArc = bulge.map(s => s.kind === 'arc' ? {...s, ccw:true} : s);
expect(boundMaterialExposureOutsideSeed(seed, inwardArc, 2, 1, 0).ok,
  'opposite arc sweep stays within cleared region');
const moved = boundMaterialExposureOutsideSeed({ ...seed, center:{x:12,y:-20} },
  [{ kind:'line', start:{x:12,y:-12}, end:{x:12,y:-11} }], 2, 1, 140);
expect(moved.ok && Math.abs(moved.maxExposedAngleDeg! - partial.maxExposedAngleDeg!) < 1e-6,
  'rotation and translation preserve exposure');

const prior: CanonicalToolpath = { version:1, operationKind:'contour', strategy:'contour',
  sourceOperationId:'seed-cut', tool:{diameterMm:6}, stepoverPercent:0,
  runs:[{kind:'cut',z:-2,points:[{x:6,y:-3},{x:4,y:-3},{x:6,y:-3}],segments:[
    {kind:'arc',start:{x:6,y:-3},end:{x:4,y:-3},center:{x:5,y:-3},ccw:true},
    {kind:'arc',start:{x:4,y:-3},end:{x:6,y:-3},center:{x:5,y:-3},ccw:true}
  ]}] };
const constructed = constructAssumedDiskFromCanonicalRun(prior, 0);
expect(constructed.ok, 'canonical seed fixture');
if (constructed.ok) {
  const leavingSeed: SemanticSegment[] = [{kind:'line',start:{x:6,y:-3},end:{x:8.5,y:-3}}];
  expect(!proveAssumedSeedClearance(constructed.disk, leavingSeed, 1, 1).ok,
    'candidate cuts beyond fully cleared seed');
  expect(boundMaterialExposureOutsideSeed(constructed.disk, leavingSeed, 1, 1, 140).ok,
    'E5D -> E6A gives a conditional limited-exposure cutting path');
}
const guide: Extract<SemanticSegment,{kind:'line'}> = {kind:'line',start:{x:0,y:0},end:{x:100,y:0}};
const reference = buildStraightTrochoid(guide, {radiusMm:4,forwardStepMm:2,freeSide:'left',loopDirection:'ccw'});
expect(reference.ok, 'straight reference');
if (reference.ok) {
  const proof = boundMaterialExposureOutsideSeed({center:{x:0,y:4},radiusMm:9,clearedToDepthMm:2},
    reference.segments, 3, 1, 140);
  expect(!proof.ok && proof.maxExposedAngleDeg === 360, 'whole reference fails despite a cleared first loop');
}
for (const limit of [-1, 180, 360, NaN])
  expect(boundMaterialExposureOutsideSeed(seed, [line(0,1)], 2, 1, limit).maxExposedAngleDeg === null,
    'invalid policy has no measured pass');
expect(boundMaterialExposureOutsideSeed(seed, [line(0,1)], 2, 3, 140).maxExposedAngleDeg === null,
  'unknown depth cannot produce an exposure bound');
expect(boundMaterialExposureOutsideSeed(seed, [line(0,1),line(2,3)], 2, 1, 140).maxExposedAngleDeg === null,
  'discontinuous path has no bound');
expect(boundMaterialExposureOutsideSeed(seed, [line(8,13), null as unknown as SemanticSegment], 2, 1, 140)
  .maxExposedAngleDeg === null, 'invalid suffix invalidates a partial bound after threshold failure');
expect(boundMaterialExposureOutsideSeed(seed, [line(0,1)], 10, 1, 140).maxExposedAngleDeg === null,
  'tool larger than usable seed invalidates the monotonicity domain');
expect(boundMaterialExposureOutsideSeed(seed, [null as unknown as SemanticSegment], 2, 1, 140).maxExposedAngleDeg === null,
  'malformed primitive fails closed');
expect(boundMaterialExposureOutsideSeed(seed, [], 2, 1, 140).maxExposedAngleDeg === null, 'empty path');
expect(boundMaterialExposureOutsideSeed({ ...seed, center:{x:1e12,y:0} },
  [{kind:'line',start:{x:1e12,y:0},end:{x:1e12+1,y:0}}], 2, 1, 140).maxExposedAngleDeg === null,
  'numerical budget cannot silently discard reserves');
console.log('010-E6A material circumference exposure: PASS');
