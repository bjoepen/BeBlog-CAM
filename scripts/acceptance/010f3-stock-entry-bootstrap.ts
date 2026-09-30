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
  expect(r.startup.fullWidth && r.startup.rampLegCount>=2,'startup full-width phase explicit');
  expect(r.startup.segments[0].start.z===0,'entry starts at stock surface');
  expect(r.bootstrapExposureBoundsDeg.every(a=>a<=140),'all bootstrap loops obey policy');
  expect(Math.abs(r.seed.radiusMm-7.1)<1e-9 && r.seed.clearedToDepthMm===1,'seed derived from completed bootstrap');
  expect(JSON.stringify({guide,loop,options})===before,'inputs unchanged');
  const end=r.startup.segments.at(-1)!.end,start=r.bootstrap[0].start;
  expect(end.x===start.x && end.y===start.y && end.z===-1,'slot ends at bootstrap center');
  expect(JSON.stringify(r.bootstrap.at(-1)!.end)===JSON.stringify(r.bridge.start)
    && JSON.stringify(r.bridge.end)===JSON.stringify(r.contour.material.segments[0].start),'continuous bootstrap bridge contour');
  for(const [i,s] of r.startup.segments.entries()) {
    if(i>0)expect(JSON.stringify(r.startup.segments[i-1].end)===JSON.stringify(s.start),'startup continuity');
    if(i<r.startup.rampLegCount)expect(s.end.z<s.start.z && s.feedMmMin===180,'ramp strictly descends');
    else expect(s.start.z===-1 && s.end.z===-1 && s.feedMmMin===120,'full chord clearing at target depth');
    for(let j=0;j<=16;j++)for(let k=0;k<128;k++) {
      const t=j/16,a=2*Math.PI*k/128;
      expect(sourceSafe(s.start.x+t*(s.end.x-s.start.x)+3*Math.cos(a),
        s.start.y+t*(s.end.y-s.start.y)+3*Math.sin(a)),'startup cutter footprint protects source');
    }
  }
  const flat=r.startup.segments[r.startup.rampLegCount];
  const cx=r.seed.center.x,cy=r.seed.center.y;
  const vx=flat.start.x-flat.end.x,vy=flat.start.y-flat.end.y,L=Math.hypot(vx,vy),ux=vx/L,uy=vy/L;
  let previousDiskRadius:number|null=null;
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
        const localX=x*ux+y*uy,localY=-x*uy+y*ux;
        const free=cycle===0?Math.hypot(localX-Math.max(-L/2,Math.min(L/2,localX)),localY)<=3
          :Math.hypot(x,y)<=previousDiskRadius!;
        if(!free)outside++;
      }
      expect(outside*360/2048<=r.bootstrapExposureBoundsDeg[cycle]+720/2048,'independent cleared-slot/disk circumference bound');
    }
    // Independent coverage: new disk is old slot/disk union the full circle annulus.
    for(let radial=0;radial<=16;radial++)for(let j=0;j<64;j++) {
      const d=(last.radius+3-1e-6)*radial/16,a=2*Math.PI*j/64;
      const x=d*Math.cos(a),y=d*Math.sin(a),lx=x*ux+y*uy,ly=-x*uy+y*ux;
      const old=cycle===0?Math.hypot(lx-Math.max(-L/2,Math.min(L/2,lx)),ly)<=3
        :Math.hypot(x,y)<=previousDiskRadius!;
      expect(old || Math.abs(Math.hypot(x,y)-last.radius)<=3,'bootstrap disk fully covered');
    }
    previousDiskRadius=last.radius+3-1e-6;
  }
  for(const bad of [{allowFullWidthStartup:false},{allowedExposedAngleDeg:80},{bootstrapStepMm:10},
    {seedExtraRadiusMm:2},{maximumRampAngleDeg:1e-9},{bootstrapStepMm:1e-9},{targetDepthMm:0}]) {
    const rejected=buildTrochoidStockEntryReference(guide,loop,3,{...options,...bad});
    expect(!rejected.ok && rejected.startup===null && rejected.bootstrap.length===0
      && rejected.seed===null && rejected.contour===null,'unsafe startup returns no partial candidate');
  }
}
console.log('010-F3 stock entry and bounded bootstrap: PASS');
