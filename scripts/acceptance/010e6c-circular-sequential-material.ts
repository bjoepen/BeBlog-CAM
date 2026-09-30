import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import { assessTrochoidalGuideEligibility } from '../../src/lib/trochoidalGuideEligibility';
import { buildSemanticTrochoid } from '../../src/lib/trochoidalSemanticMath';
import { assessCircularTrochoidSequentialMaterial } from '../../src/lib/trochoidalSequentialMaterial';
import { boundMaterialExposureOutsideSeed } from '../../src/lib/trochoidalMaterialExposure';
import type { AssumedClearedDisk } from '../../src/lib/trochoidalSeedClearance';
import type { SemanticSegment } from '../../src/lib/contourMath';

const expect = (ok: boolean, message: string) => { if (!ok) throw new Error(message); };
const options = { radiusMm: 4, forwardStepMm: .5, loopDirection: 'ccw' as const };
for (const side of ['outside', 'inside'] as const) {
  for (const reflect of [false, true]) for (const loopDirection of ['cw', 'ccw'] as const) {
    const built = buildTrochoidalContourGuide([{kind:'circle',center:{x:0,y:0},radius:20}],
      {...defaultTrochoidalContourContract,contourId:0,side},
      p => ({x:(reflect ? -p.y : p.y)+12,y:p.x-7}));
    if (!built.ok) throw new Error(built.errors.join(' '));
    const guide = built.guide, opts = {...options,loopDirection};
    const eligible = assessTrochoidalGuideEligibility(guide,4,.5);
    if (!eligible.ok) throw new Error(eligible.errors.join(' '));
    const native = buildSemanticTrochoid(guide.segments,{...opts,freeSide:eligible.freeSide});
    if (!native.ok || native.segments[0].kind !== 'arc') throw new Error('reference missing');
    const seed: AssumedClearedDisk = {center:{...native.segments[0].center},radiusMm:9,clearedToDepthMm:3};
    const before = JSON.stringify({guide,opts,seed});
    const result = assessCircularTrochoidSequentialMaterial(guide,opts,seed,3,1,140);
    expect(result.ok, `native ${side} circle passes: ${result.errors.join(' ')}`);
    if (!result.ok) continue;
    expect(JSON.stringify(result.segments) === JSON.stringify(native.segments),'native geometry unchanged');
    expect(JSON.stringify({guide,opts,seed}) === before,'inputs unchanged');
    expect(result.segments.length === 3*result.loopCount,'closed reference has explicit closing line');
    expect(result.closingExposureBoundDeg !== null && result.closingExposureBoundDeg <= 140,'closure bounded');
    expect(result.finalAssumedDisk.clearedToDepthMm === 1,'only target depth credited');
    expect(!boundMaterialExposureOutsideSeed(seed,result.segments,3,1,140).ok,'frozen seed rejects full circle');
    let old = seed;
    // Independent sampling of old-disk circumference and new-disk coverage.
    const checkExposure = (motions: SemanticSegment[], bound: number) => {
      for (const m of motions) for (let i=0;i<=8;i++) {
        const t=i/8, a=m.kind==='arc'?Math.atan2(m.start.y-m.center.y,m.start.x-m.center.x):0;
        const p=m.kind==='line'?{x:m.start.x+t*(m.end.x-m.start.x),y:m.start.y+t*(m.end.y-m.start.y)}
          :{x:m.center.x+m.radius*Math.cos(a+(m.ccw?1:-1)*Math.PI*t),
            y:m.center.y+m.radius*Math.sin(a+(m.ccw?1:-1)*Math.PI*t)};
        let outside=0;
        for(let j=0;j<1024;j++) {
          const b=2*Math.PI*j/1024;
          if(Math.hypot(p.x+3*Math.cos(b)-old.center.x,p.y+3*Math.sin(b)-old.center.y)>old.radiusMm) outside++;
        }
        expect(outside*360/1024 <= bound+720/1024,'bound dominates independent circumference samples');
      }
    };
    for(let cycle=0;cycle<result.loopCount;cycle++) {
      const offset=cycle===0?0:2+(cycle-1)*3;
      const motions=result.segments.slice(offset,offset+(cycle===0?2:3));
      checkExposure(motions,result.cycleExposureBoundsDeg[cycle]);
      const last=motions[motions.length-1];
      if(last.kind!=='arc') throw new Error('arc missing');
      for(let radial=0;radial<=8;radial++) for(let j=0;j<32;j++) {
        const r=(last.radius+3-1e-6)*radial/8,a=2*Math.PI*j/32;
        const p={x:last.center.x+r*Math.cos(a),y:last.center.y+r*Math.sin(a)};
        expect(Math.hypot(p.x-old.center.x,p.y-old.center.y)<=old.radiusMm
          || Math.abs(Math.hypot(p.x-last.center.x,p.y-last.center.y)-last.radius)<=3,'propagated disk covered');
      }
      old={center:{...last.center},radiusMm:last.radius+3-1e-6,clearedToDepthMm:1};
    }
    checkExposure(result.segments.slice(-1),result.closingExposureBoundDeg!);
    expect(JSON.stringify(old)===JSON.stringify(result.finalAssumedDisk),'closing link earns no new disk');
    const rejected=assessCircularTrochoidSequentialMaterial(guide,{...opts,forwardStepMm:4},seed,3,1,140);
    expect(!rejected.ok && rejected.segments.length===0 && rejected.finalAssumedDisk===null,'large step returns no partial path');
    expect(!assessCircularTrochoidSequentialMaterial(guide,opts,seed,3,4,140).ok,'insufficient seed depth fails');
    expect(!assessCircularTrochoidSequentialMaterial(guide,opts,seed,3,1,180).ok,'invalid policy fails');
    expect(!assessCircularTrochoidSequentialMaterial(guide,{...opts,radiusMm:NaN},seed,3,1,140).ok,'invalid radius fails');
    expect(!assessCircularTrochoidSequentialMaterial({...guide,signedOffsetMm:-guide.signedOffsetMm},opts,seed,3,1,140).ok,'forged guide fails');
    expect(!assessCircularTrochoidSequentialMaterial(guide,opts,{...seed,center:{x:NaN,y:0}},3,1,140).ok,'nonfinite seed fails');
    const absent=assessCircularTrochoidSequentialMaterial(guide,opts,{...seed,radiusMm:3.1},3,1,140);
    expect(absent.ok === false && absent.failingCycleIndex===0,'first cycle cannot credit itself');
  }
}
const capsule = buildTrochoidalContourGuide([{kind:'polyline',closed:true,points:[
  {x:0,y:0},{x:30,y:0},{x:30,y:20},{x:0,y:20}
]}],{...defaultTrochoidalContourContract,contourId:0});
expect(capsule.ok,'non-circle fixture is a valid offset guide');
if(capsule.ok) expect(!assessCircularTrochoidSequentialMaterial(capsule.guide,options,
  {center:{x:0,y:0},radiusMm:100,clearedToDepthMm:3},3,1,140).ok,'non-circle is not released even with abundant assumed clearance');
console.log('010-E6C circular sequential material assessment: PASS');
