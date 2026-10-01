import { buildCanonicalTrochoidMultiDepthReference } from '../../src/lib/trochoidalCanonicalMultiDepth';
import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import type { Curve2 } from '../../src/lib/types';

const expect=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
const same=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>
  a.x===b.x&&a.y===b.y&&a.z===b.z;
const base={allowFullWidthStartup:true,totalDepthMm:2.4,stepDownMm:1,safeZMm:5,rapidFeedMmMin:900,
  maximumRampAngleDeg:3,rampFeedMmMin:180,startupFeedMmMin:120,seedExtraRadiusMm:.1,
  bootstrapStepMm:.5,allowedExposedAngleDeg:140};
const shapes:Curve2[][]=[
  [{kind:'circle',center:{x:0,y:0},radius:20}],
  [{kind:'polyline',closed:true,points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],bulges:[0,1,0,1]}]
];

for(const curves of shapes)for(const side of ['outside','inside'] as const)for(const loopDirection of ['cw','ccw'] as const) {
  const guide=buildTrochoidalContourGuide(curves,{...defaultTrochoidalContourContract,contourId:0,side},
    p=>{const a=.37;return{x:12+p.x*Math.cos(a)-p.y*Math.sin(a),y:-7+p.x*Math.sin(a)+p.y*Math.cos(a)};});
  if(!guide.ok)throw new Error('guide');
  const loop={radiusMm:4,forwardStepMm:.5,loopDirection};
  const before=JSON.stringify({guide:guide.guide,loop,base});
  const r=buildCanonicalTrochoidMultiDepthReference(guide.guide,loop,3,base);
  expect(r.ok,`${side} canonical F5: ${r.errors.join(' ')}`);
  if(!r.ok)continue;
  expect(JSON.stringify(r.levels.map(l=>l.depthMm))===JSON.stringify([1,2,2.4]),'exact depth schedule');
  expect(r.motions.length===r.levels.reduce((n,l)=>n+l.motions.length,0),'flat chain covers all levels');
  expect(JSON.stringify({guide:guide.guide,loop,base})===before,'inputs immutable');

  for(let i=1;i<r.motions.length;i++)expect(same(r.motions[i-1].end,r.motions[i].start),'global XYZ continuity');
  for(const level of r.levels) {
    const z=-level.depthMm;
    const arcs=level.motions.filter(m=>m.kind==='arc3');
    expect(arcs.length>0,'native canonical arcs exist');
    const helicalArcs=arcs.filter(a=>a.start.z!==a.end.z);
    const planarArcs=arcs.filter(a=>a.start.z===a.end.z);
    expect(helicalArcs.length>=2,'canonical helical entry arcs exist');
    expect(helicalArcs[0].start.z===0&&helicalArcs.at(-1)!.end.z===z,'helical entry spans surface to exact level depth');
    expect(helicalArcs.every(a=>a.start.z> a.end.z&&a.start.z<=0&&a.end.z>=z),'helical entry descends monotonically within level bounds');
    for(let i=1;i<helicalArcs.length;i++)expect(same(helicalArcs[i-1].end,helicalArcs[i].start),'helical arc chain is XYZ-continuous');
    expect(planarArcs.length>0&&planarArcs.every(a=>a.start.z===z&&a.end.z===z),'planar canonical arcs stay at level depth');
    const firstPlanarArc=level.motions.findIndex(m=>m.kind==='arc3'&&m.start.z===z&&m.end.z===z);
    const lastHelicalArc=level.motions.reduce((last,m,index)=>m.kind==='arc3'&&m.start.z!==m.end.z?index:last,-1);
    expect(lastHelicalArc>=0&&firstPlanarArc===lastHelicalArc+1,'completed target-depth seed circle immediately follows helix');
    const rapids=level.motions.filter(m=>m.kind==='rapid3');
    expect(rapids.every(m=>m.start.z===base.safeZMm&&m.end.z===base.safeZMm),'rapid3 only at safe Z');
    expect(level.motions.at(-1)?.end.z===base.safeZMm,'each level ends retracted');
  }
  expect(r.levels[0].motions.every(m=>m.kind!=='rapid3'),'first level has no unnecessary lateral rapid');
  expect(r.levels.slice(1).every(l=>l.motions[0]?.kind==='rapid3'),'later levels begin with safe lateral rapid');
}

const guide=buildTrochoidalContourGuide(shapes[0],{...defaultTrochoidalContourContract,contourId:0,side:'outside'});
if(!guide.ok)throw new Error('guide');
const loop={radiusMm:4,forwardStepMm:.5,loopDirection:'cw' as const};
for(const bad of [{safeZMm:0},{totalDepthMm:0},{stepDownMm:0},{allowedExposedAngleDeg:80}]) {
  const r=buildCanonicalTrochoidMultiDepthReference(guide.guide,loop,3,{...base,...bad});
  expect(!r.ok&&r.levels.length===0&&r.motions.length===0,'inherited F4 failure stays atomic');
}
console.log('010-F5 canonical multi-depth chain: PASS');
