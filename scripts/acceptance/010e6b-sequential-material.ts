import type { SemanticSegment, P2 } from '../../src/lib/contourMath';
import { assessStraightTrochoidSequentialMaterial } from '../../src/lib/trochoidalSequentialMaterial';
import { boundMaterialExposureOutsideSeed } from '../../src/lib/trochoidalMaterialExposure';
import { buildStraightTrochoid, type StraightTrochoidOptions } from '../../src/lib/trochoidalStraightMath';

const expect = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const guide: Extract<SemanticSegment, {kind:'line'}> = {kind:'line',start:{x:0,y:0},end:{x:20.5,y:0}};
const options: StraightTrochoidOptions = {radiusMm:4,forwardStepMm:1,freeSide:'left',loopDirection:'ccw'};
const seed = {center:{x:0,y:4},radiusMm:9,clearedToDepthMm:3};
const assess = (opts = options, disk = seed, depth = 1, limit = 140) =>
  assessStraightTrochoidSequentialMaterial(guide, opts, disk, 3, depth, limit);
const result = assess();
expect(result.ok, 'ordered small-step chain passes');
if (result.ok) {
  expect(result.loopCount === 22 && result.segments.length === 65, 'short final step retained');
  expect(result.cycleExposureBoundsDeg.length === 22 && result.cycleExposureBoundsDeg[0] === 0
    && result.cycleExposureBoundsDeg.every(a => a <= 140), 'every complete link/loop has a bound');
  expect(Math.abs(result.finalAssumedDisk.radiusMm - 6.999999) < 1e-10
    && result.finalAssumedDisk.center.x === 20.5 && result.finalAssumedDisk.center.y === 4
    && result.finalAssumedDisk.clearedToDepthMm === 1, 'final disk credits only the cut depth');
  expect(!boundMaterialExposureOutsideSeed(seed, result.segments, 3, 1, 140).ok,
    'frozen-seed evaluation rejects the same complete chain');
  const original = buildStraightTrochoid(guide, options);
  expect(original.ok && JSON.stringify(original.segments) === JSON.stringify(result.segments),
    'assessment retains the original native geometry');

  // Independent dense geometric oracle: cutter circumference outside the OLD
  // disk is counted for sampled centers along each link and semicircle. The
  // returned bound must dominate these samples, never crediting its own loop.
  let old = seed;
  for (let cycle = 0; cycle < result.loopCount; cycle++) {
    const offset = cycle === 0 ? 0 : 2 + (cycle - 1) * 3;
    const motions = result.segments.slice(offset, offset + (cycle === 0 ? 2 : 3));
    for (const motion of motions) {
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const a = motion.kind === 'arc' ? Math.atan2(motion.start.y-motion.center.y, motion.start.x-motion.center.x) : 0;
        const p: P2 = motion.kind === 'line'
          ? {x:motion.start.x+t*(motion.end.x-motion.start.x),y:motion.start.y+t*(motion.end.y-motion.start.y)}
          : {x:motion.center.x+motion.radius*Math.cos(a+(motion.ccw?1:-1)*Math.PI*t),
            y:motion.center.y+motion.radius*Math.sin(a+(motion.ccw?1:-1)*Math.PI*t)};
        let outside = 0;
        const samples = 4096;
        for (let j = 0; j < samples; j++) {
          const angle = 2*Math.PI*j/samples;
          if (Math.hypot(p.x+3*Math.cos(angle)-old.center.x,p.y+3*Math.sin(angle)-old.center.y) > old.radiusMm)
            outside++;
        }
        expect(outside*360/samples <= result.cycleExposureBoundsDeg[cycle] + 720/samples,
          'continuous bound dominates independently sampled old-disk exposure');
      }
    }
    const arc = motions[motions.length-1];
    if (arc.kind !== 'arc') throw new Error('loop arc missing');
    // Independent coverage oracle for the new disk: old free material OR the
    // full circle's cutter annulus must cover every sampled point.
    for (let radial = 0; radial <= 16; radial++) for (let angular = 0; angular < 32; angular++) {
      const r = (4+3-1e-6)*radial/16, a = 2*Math.PI*angular/32;
      const x = arc.center.x+r*Math.cos(a), y = arc.center.y+r*Math.sin(a);
      expect(Math.hypot(x-old.center.x,y-old.center.y) <= old.radiusMm
        || Math.abs(Math.hypot(x-arc.center.x,y-arc.center.y)-4) <= 3,
      'new disk is covered by old disk plus completed circular sweep');
    }
    old = {center:{...arc.center},radiusMm:6.999999,clearedToDepthMm:1};
  }
}
const largeStep = assess({...options,forwardStepMm:2});
expect(largeStep.ok === false && largeStep.failingCycleIndex === 1 && largeStep.finalAssumedDisk === null
  && largeStep.segments.length === 0, 'larger step fails before crediting its sweep');
expect(!assess(options,seed,1,100).ok, 'stricter caller policy rejects the chain');
expect(!assess(options,seed,4).ok, 'deeper than initial clearance fails');
const absentSeed = assess(options,{...seed,radiusMm:3.1});
expect(absentSeed.ok === false && absentSeed.failingCycleIndex === 0, 'first loop cannot clear its own start zone');
expect(!assess({...options,forwardStepMm:NaN}).ok, 'invalid generation fails');
expect(!assess(options,seed,1,180).ok, 'invalid exposure policy fails');
expect(!assess(options,{...seed,center:{x:NaN,y:4}}).ok, 'invalid disk fails');
const before = JSON.stringify({guide,options,seed});
assess();
expect(before === JSON.stringify({guide,options,seed}), 'inputs remain unchanged');
for (const freeSide of ['left','right'] as const) for (const loopDirection of ['cw','ccw'] as const) {
  const transformed = assessStraightTrochoidSequentialMaterial(
    {kind:'line',start:{x:12,y:-7},end:{x:12,y:13.5}}, {...options,freeSide,loopDirection},
    {center:{x:freeSide==='left'?8:16,y:-7},radiusMm:9,clearedToDepthMm:3},3,1,140);
  expect(transformed.ok, 'rotated/translated chain in either side and winding');
  if (transformed.ok && result.ok) expect(transformed.cycleExposureBoundsDeg.every((a,i) =>
    Math.abs(a-result.cycleExposureBoundsDeg[i]) < 1e-5), 'rigid transform preserves bounds');
}
expect(assessStraightTrochoidSequentialMaterial(guide,{...options,radiusMm:1,forwardStepMm:.5},
  {center:{x:0,y:1},radiusMm:5,clearedToDepthMm:1},3,1,140).ok,
  'loop smaller than tool has no central hole');
console.log('010-E6B sequential trochoid material assessment: PASS');
