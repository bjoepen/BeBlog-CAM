import { buildAssumedSeedRamp, buildProtectedTrochoidRampReference } from '../../src/lib/trochoidalRampEntry';
import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import { assessTrochoidalGuideEligibility } from '../../src/lib/trochoidalGuideEligibility';
import { buildSemanticTrochoid } from '../../src/lib/trochoidalSemanticMath';
import type { Curve2 } from '../../src/lib/types';

const expect=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
const disk={center:{x:0,y:4},radiusMm:7.1,clearedToDepthMm:3};
const endpoint={x:0,y:8};
const options={startDepthMm:0,targetDepthMm:1,maximumAngleDeg:3,feedMmMin:180};
const ramp=buildAssumedSeedRamp(disk,endpoint,3,options);
expect(ramp.ok,'reference ramp passes');
if(ramp.ok) {
  expect(ramp.legCount===4 && ramp.xyLengthMm===32,'1mm at max 3deg uses four 8mm legs');
  expect(ramp.actualAngleDeg<3 && ramp.actualAngleDeg>0,'actual slope within caller maximum');
  expect(ramp.segments.every(s=>s.kind==='line3' && s.feedMmMin===180),'native linear ramp with ramp feed');
  expect(ramp.segments[0].start.z===0,'starts at surface');
  const last=ramp.segments[ramp.segments.length-1];
  expect(last.end.x===endpoint.x && last.end.y===endpoint.y && last.end.z===-1,'exact depth and XY endpoint');
  for(const [i,s] of ramp.segments.entries()) {
    expect(s.end.z<s.start.z,'every move strictly descends');
    expect(Math.atan2(s.start.z-s.end.z,Math.hypot(s.end.x-s.start.x,s.end.y-s.start.y))*180/Math.PI<=3,'every move obeys max angle');
    if(i>0)expect(JSON.stringify(ramp.segments[i-1].end)===JSON.stringify(s.start),'continuous native 3D moves');
    for(let j=0;j<=16;j++)for(let k=0;k<128;k++) {
      const t=j/16,a=2*Math.PI*k/128;
      const x=s.start.x+t*(s.end.x-s.start.x)+3*Math.cos(a);
      const y=s.start.y+t*(s.end.y-s.start.y)+3*Math.sin(a);
      expect(Math.hypot(x-disk.center.x,y-disk.center.y)<disk.radiusMm,'independent cutter samples stay inside seed');
    }
  }
}
const previous=buildAssumedSeedRamp(disk,endpoint,3,{...options,startDepthMm:1,targetDepthMm:2});
expect(previous.ok && previous.segments[0].start.z===-1 && previous.segments.at(-1)!.end.z===-2,'previous layer depth supported');
const before=JSON.stringify({disk,endpoint,options});buildAssumedSeedRamp(disk,endpoint,3,options);
expect(before===JSON.stringify({disk,endpoint,options}),'inputs unchanged');
for(const bad of [{maximumAngleDeg:0},{maximumAngleDeg:16},{maximumAngleDeg:NaN},
  {maximumAngleDeg:1e-9},{feedMmMin:0},{startDepthMm:-1},{startDepthMm:1},
  {targetDepthMm:4},{targetDepthMm:Infinity}]) {
  const r=buildAssumedSeedRamp(disk,endpoint,3,{...options,...bad});
  expect(!r.ok && r.segments.length===0,'invalid or over-budget ramp returns no partial moves');
}
expect(!buildAssumedSeedRamp(disk,disk.center,3,options).ok,'no radial pendulum span fails');
expect(!buildAssumedSeedRamp(disk,{x:0,y:9},3,options).ok,'endpoint cutter outside seed fails');
expect(!buildAssumedSeedRamp({...disk,center:{x:NaN,y:4}},endpoint,3,options).ok,'invalid seed fails');
expect(!buildAssumedSeedRamp(disk,endpoint,8,options).ok,'tool too large fails');

const shapes:Curve2[][]=[[{kind:'circle',center:{x:0,y:0},radius:20}],
  [{kind:'polyline',closed:true,points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],bulges:[0,1,0,1]}]];
for(const curves of shapes)for(const side of ['outside','inside'] as const)for(const loopDirection of ['cw','ccw'] as const) {
  const built=buildTrochoidalContourGuide(curves,{...defaultTrochoidalContourContract,contourId:0,side},
    p=>{const a=.37;return{x:12+p.x*Math.cos(a)-p.y*Math.sin(a),y:-7+p.x*Math.sin(a)+p.y*Math.cos(a)};});
  if(!built.ok)throw new Error('guide');
  const loop={radiusMm:4,forwardStepMm:.5,loopDirection};
  const eligible=assessTrochoidalGuideEligibility(built.guide,4,.5);
  if(!eligible.ok)throw new Error('eligible');
  const path=buildSemanticTrochoid(built.guide.segments,{...loop,freeSide:eligible.freeSide});
  if(!path.ok || path.segments[0].kind!=='arc')throw new Error('reference');
  const seed={center:{...path.segments[0].center},radiusMm:7.1,clearedToDepthMm:3};
  const result=buildProtectedTrochoidRampReference(built.guide,loop,seed,3,140,options);
  expect(result.ok,`combined reference ${side}: ${result.errors.join(' ')}`);
  if(result.ok) {
    const end=result.ramp.segments.at(-1)!.end,start=result.protectedPath.material.segments[0].start;
    expect(end.x===start.x && end.y===start.y && end.z===-1,'no gap from ramp to first loop');
    expect(JSON.stringify(result.protectedPath.material.segments)===JSON.stringify(path.segments),'ramp changes no loop geometry');
  }
  const rejected=buildProtectedTrochoidRampReference(built.guide,loop,seed,3,140,{...options,maximumAngleDeg:1e-9});
  expect(!rejected.ok && rejected.ramp===null && rejected.protectedPath===null,'ramp failure discards complete candidate');
  expect(!buildProtectedTrochoidRampReference(built.guide,loop,{...seed,radiusMm:9},3,140,options).ok,'overlapping seed cannot acquire ramp approval');
}
console.log('010-F1 assumed-seed ramp entry: PASS');
