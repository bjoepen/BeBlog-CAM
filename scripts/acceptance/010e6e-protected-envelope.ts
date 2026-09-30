import type { Curve2 } from '../../src/lib/types';
import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import { assessTrochoidalGuideEligibility } from '../../src/lib/trochoidalGuideEligibility';
import { buildSemanticTrochoid } from '../../src/lib/trochoidalSemanticMath';
import { assessProtectedTrochoidSequentialMaterial, proveTrochoidalProtectedEnvelope } from '../../src/lib/trochoidalProtectedEnvelope';

const expect=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
const shapes:Curve2[][]=[
  [{kind:'circle',center:{x:0,y:0},radius:20}],
  [{kind:'polyline',closed:true,points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],bulges:[0,1,0,1]}]
];
for(const [shapeIndex,curves] of shapes.entries()) for(const side of ['outside','inside'] as const)
  for(const loopDirection of ['cw','ccw'] as const) {
    const built=buildTrochoidalContourGuide(curves,{...defaultTrochoidalContourContract,contourId:0,side},
      p=>{const a=.37;return{x:12+p.x*Math.cos(a)-p.y*Math.sin(a),y:-7+p.x*Math.sin(a)+p.y*Math.cos(a)};});
    if(!built.ok)throw new Error(built.errors.join(' '));
    const guide=built.guide,options={radiusMm:4,forwardStepMm:.5,loopDirection};
    const eligible=assessTrochoidalGuideEligibility(guide,4,.5);
    if(!eligible.ok)throw new Error('eligibility');
    const native=buildSemanticTrochoid(guide.segments,{...options,freeSide:eligible.freeSide});
    if(!native.ok || native.segments[0].kind!=='arc')throw new Error('native path');
    const seed={center:{...native.segments[0].center},radiusMm:7.1,clearedToDepthMm:3};
    const before=JSON.stringify({guide,options,seed});
    const result=assessProtectedTrochoidSequentialMaterial(guide,options,seed,3,1,140);
    expect(result.ok,`${shapeIndex} ${side}: ${result.errors.join(' ')}`);
    if(!result.ok)continue;
    expect(result.minimumPartClearanceMm>.099 && result.minimumPartClearanceMm<.101,'seed controls clearance bound');
    expect(JSON.stringify(result.material.segments)===JSON.stringify(native.segments),'native geometry unchanged');
    expect(before===JSON.stringify({guide,options,seed}),'inputs unchanged');
    const tooLarge={...seed,radiusMm:9};
    const rejected=assessProtectedTrochoidSequentialMaterial(guide,options,tooLarge,3,1,140);
    expect(!rejected.ok && rejected.material===null,'old 9mm assumed disk overlaps protected source and exposes no path');
    expect(!proveTrochoidalProtectedEnvelope(guide,native.segments,3.3,seed).ok,'cutter larger than offset fails');
    expect(!proveTrochoidalProtectedEnvelope(guide,native.segments,3.2,seed).ok,'zero allowance fails reserve');
    expect(!proveTrochoidalProtectedEnvelope(guide,native.segments,3,{...seed,radiusMm:7.2}).ok,'tangent seed fails reserve');
    expect(!proveTrochoidalProtectedEnvelope(guide,native.segments,3,{...seed,center:{x:NaN,y:0}}).ok,'invalid seed fails');
    expect(!proveTrochoidalProtectedEnvelope(guide,native.segments,NaN,seed).ok,'invalid tool fails');
    expect(!proveTrochoidalProtectedEnvelope(guide,[],3,seed).ok,'missing path fails');
    expect(!assessProtectedTrochoidSequentialMaterial(guide,options,seed,3,4,140).ok,'clearance depth remains conditional');
    // Independent source-domain oracle for cutter disks, seed, and every
    // propagated disk. Undo the rigid transform, then measure native source.
    const sourceClearance=(x:number,y:number)=>{
      const a=.37,dx=x-12,dy=y+7;
      const px=dx*Math.cos(a)+dy*Math.sin(a),py=-dx*Math.sin(a)+dy*Math.cos(a);
      const d=shapeIndex===0?Math.hypot(px,py):Math.hypot(px-Math.max(0,Math.min(20,px)),py-10);
      const radius=shapeIndex===0?20:10;
      return side==='outside'?d-radius:radius-d;
    };
    const checkDisk=(x:number,y:number,r:number)=>{
      for(let j=0;j<128;j++) {
        const a=2*Math.PI*j/128;
        expect(sourceClearance(x+r*Math.cos(a),y+r*Math.sin(a))>=result.minimumPartClearanceMm-1e-6,
          'sampled disk stays on protected source side with the reported reserve');
      }
    };
    checkDisk(seed.center.x,seed.center.y,seed.radiusMm);
    for(const motion of result.material.segments) {
      for(let i=0;i<=8;i++) {
        const t=i/8,a=motion.kind==='arc'?Math.atan2(motion.start.y-motion.center.y,motion.start.x-motion.center.x):0;
        const p=motion.kind==='line'?{x:motion.start.x+t*(motion.end.x-motion.start.x),y:motion.start.y+t*(motion.end.y-motion.start.y)}
          :{x:motion.center.x+motion.radius*Math.cos(a+(motion.ccw?1:-1)*Math.PI*t),
            y:motion.center.y+motion.radius*Math.sin(a+(motion.ccw?1:-1)*Math.PI*t)};
        checkDisk(p.x,p.y,3);
      }
    }
    for(let cycle=0;cycle<result.material.loopCount;cycle++) {
      const last=result.material.segments[cycle===0?1:4+(cycle-1)*3];
      if(last.kind!=='arc')throw new Error('loop missing');
      checkDisk(last.center.x,last.center.y,last.radius+3-1e-6);
    }
  }
console.log('010-E6E protected cutter and seed envelope: PASS');
