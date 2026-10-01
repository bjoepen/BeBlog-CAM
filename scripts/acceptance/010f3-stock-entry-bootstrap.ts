import { buildTrochoidStockEntryReference } from '../../src/lib/trochoidalStockEntry';
import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import type { Curve2 } from '../../src/lib/types';

const expect=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
const options={allowFullWidthStartup:true,targetDepthMm:1,maximumRampAngleDeg:3,rampFeedMmMin:180,
  startupFeedMmMin:120,seedExtraRadiusMm:.1,bootstrapStepMm:.5,allowedExposedAngleDeg:140};
const shapes:Curve2[][]=[[{kind:'circle',center:{x:0,y:0},radius:20}],
  [{kind:'polyline',closed:true,points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],bulges:[0,1,0,1]}]];
for(const curves of shapes)for(const side of ['outside','inside'] as const)for(const loopDirection of ['cw','ccw'] as const) {
  const built=buildTrochoidalContourGuide(curves,{...defaultTrochoidalContourContract,contourId:0,side},
    p=>{const a=.37;return{x:12+p.x*Math.cos(a)-p.y*Math.sin(a),y:-7+p.x*Math.sin(a)+p.y*Math.cos(a)};});
  if(!built.ok)throw new Error('guide');
  const guide=built.guide,loop={radiusMm:4,forwardStepMm:.5,loopDirection};
  const sourceSafe=(x:number,y:number)=>{
    const a=.37,dx=x-12,dy=y+7,px=dx*Math.cos(a)+dy*Math.sin(a),py=-dx*Math.sin(a)+dy*Math.cos(a);
    const circle=curves[0].kind==='circle';
    const d=circle?Math.hypot(px,py):Math.hypot(px-Math.max(0,Math.min(20,px)),py-10);
    return side==='outside'?d>=(circle?20:10)+1e-5:d<=(circle?20:10)-1e-5;
  };
  const before=JSON.stringify({guide,loop,options});
  const r=buildTrochoidStockEntryReference(guide,loop,3,options);
  expect(r.ok,`${side} stock entry: ${r.errors.join(' ')}`);
  if(!r.ok)continue;
  expect(r.startup.fullWidth && r.startup.rampLegCount>=1,'startup full-width phase explicit');
  expect(r.startup.segments[0].start.z===0,'entry starts at stock surface');
  expect(r.bootstrapExposureBoundsDeg.every(a=>a<=140),'all bootstrap loops obey policy');
  expect(r.seed.radiusMm>=7.1-1e-9 && r.seed.clearedToDepthMm===1,'seed derived from completed circular startup/bootstrap');
  expect(JSON.stringify({guide,loop,options})===before,'inputs unchanged');
  const seedArcs=r.startup.segments.slice(r.startup.rampLegCount*2);
  expect(seedArcs.length===2 && seedArcs.every(s=>s.kind==='arc3'&&s.start.z===-1&&s.end.z===-1&&s.feedMmMin===120),
    'completed target-depth seed circle follows helix');
  const startupEnd=r.startup.segments.at(-1)!.end;
  const nextStart=r.bootstrap.length?r.bootstrap[0].start:r.bridge.start;
  expect(startupEnd.x===nextStart.x && startupEnd.y===nextStart.y && startupEnd.z===-1,'seed circle joins bootstrap/bridge');
  expect((!r.bootstrap.length || JSON.stringify(r.bootstrap.at(-1)!.end)===JSON.stringify(r.bridge.start))
    && JSON.stringify(r.bridge.end)===JSON.stringify(r.contour.material.segments[0].start),'continuous bootstrap bridge contour');
  for(const [i,s] of r.startup.segments.entries()) {
    if(i>0)expect(JSON.stringify(r.startup.segments[i-1].end)===JSON.stringify(s.start),'startup continuity');
    if(i<r.startup.rampLegCount*2)expect(s.end.z<s.start.z && s.feedMmMin===180 && s.kind==='arc3','helix strictly descends');
    else expect(s.start.z===-1 && s.end.z===-1 && s.feedMmMin===120 && s.kind==='arc3','seed circle clears at target depth');
    if(s.kind!=='arc3')throw new Error('startup arc3');
    const radius=Math.hypot(s.start.x-s.center.x,s.start.y-s.center.y),a0=Math.atan2(s.start.y-s.center.y,s.start.x-s.center.x);
    for(let j=0;j<=16;j++)for(let k=0;k<128;k++) {
      const t=j/16,a=a0+(s.ccw?1:-1)*Math.PI*t,b=2*Math.PI*k/128;
      expect(sourceSafe(s.center.x+radius*Math.cos(a)+3*Math.cos(b),
        s.center.y+radius*Math.sin(a)+3*Math.sin(b)),'startup cutter footprint protects source');
    }
  }
  const cx=r.seed.center.x,cy=r.seed.center.y;
  let previousDiskRadius=(seedArcs[0].kind==='arc3'?Math.hypot(seedArcs[0].start.x-seedArcs[0].center.x,
    seedArcs[0].start.y-seedArcs[0].center.y):0)+3-1e-6;
  for(let cycle=0;cycle<r.bootstrapExposureBoundsDeg.length;cycle++) {
    const motions=r.bootstrap.slice(cycle*3,cycle*3+3),last=motions.at(-1)!;
    if(last.kind!=='arc')throw new Error('arc');
    for(const m of motions)for(let i=0;i<=8;i++) {
      const t=i/8,a=m.kind==='arc'?Math.atan2(m.start.y-m.center.y,m.start.x-m.center.x):0;
      const p=m.kind==='line'?{x:m.start.x+t*(m.end.x-m.start.x),y:m.start.y+t*(m.end.y-m.start.y)}
        :{x:m.center.x+m.radius*Math.cos(a+(m.ccw?1:-1)*Math.PI*t),y:m.center.y+m.radius*Math.sin(a+(m.ccw?1:-1)*Math.PI*t)};
      let outside=0;
      for(let j=0;j<2048;j++) {
        const b=2*Math.PI*j/2048,x=p.x+3*Math.cos(b)-cx,y=p.y+3*Math.sin(b)-cy;
        expect(sourceSafe(x+cx,y+cy),'bootstrap cutter footprint protects source');
        if(Math.hypot(x,y)>previousDiskRadius)outside++;
      }
      expect(outside*360/2048<=r.bootstrapExposureBoundsDeg[cycle]+720/2048,'independent cleared-disk circumference bound');
    }
    for(let radial=0;radial<=16;radial++)for(let j=0;j<64;j++) {
      const d=(last.radius+3-1e-6)*radial/16,a=2*Math.PI*j/64,x=d*Math.cos(a),y=d*Math.sin(a);
      expect(Math.hypot(x,y)<=previousDiskRadius || Math.abs(Math.hypot(x,y)-last.radius)<=3,'bootstrap disk fully covered');
    }
    previousDiskRadius=last.radius+3-1e-6;
  }
  for(const [name,bad] of [
    ['full-width disabled',{allowFullWidthStartup:false}],
    ['80deg exposure',{allowedExposedAngleDeg:80}],
    ['10mm bootstrap step',{bootstrapStepMm:10}],
    ['300mm seed extra',{seedExtraRadiusMm:300}],
    ['near-zero ramp angle',{maximumRampAngleDeg:1e-9}],
    ['near-zero bootstrap step',{bootstrapStepMm:1e-9}],
    ['zero target depth',{targetDepthMm:0}]
  ] as const) {
    const rejected=buildTrochoidStockEntryReference(guide,loop,3,{...options,...bad});
    expect(!rejected.ok && rejected.startup===null && rejected.bootstrap.length===0
      && rejected.seed===null && rejected.contour===null,`unsafe startup returns no partial candidate: ${name}; ok=${rejected.ok}; errors=${rejected.errors.join(' | ')}`);
  }
}
console.log('010-F3 stock entry and bounded bootstrap: PASS');
