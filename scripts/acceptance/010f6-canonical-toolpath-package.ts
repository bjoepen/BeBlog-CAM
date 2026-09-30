import { buildTrochoidalCanonicalToolpath } from '../../src/lib/trochoidalCanonicalToolpath';
import { buildTrochoidalContourGuide } from '../../src/lib/trochoidalContourGuide';
import { defaultTrochoidalContourContract } from '../../src/lib/trochoidalContourContract';
import type { Curve2 } from '../../src/lib/types';

const expect=(ok:boolean,message:string)=>{if(!ok)throw new Error(message);};
const base={allowFullWidthStartup:true,totalDepthMm:2.4,stepDownMm:1,safeZMm:5,rapidFeedMmMin:900,
  maximumRampAngleDeg:3,rampFeedMmMin:180,startupFeedMmMin:120,seedExtraRadiusMm:.1,
  bootstrapStepMm:.5,allowedExposedAngleDeg:140};
const shapes:Curve2[][]=[
  [{kind:'circle',center:{x:0,y:0},radius:20}],
  [{kind:'polyline',closed:true,points:[{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}],bulges:[0,1,0,1]}]
];

for(const curves of shapes)for(const side of ['outside','inside'] as const)for(const loopDirection of ['cw','ccw'] as const){
  const guide=buildTrochoidalContourGuide(curves,{...defaultTrochoidalContourContract,contourId:0,side},
    p=>{const a=.37;return{x:12+p.x*Math.cos(a)-p.y*Math.sin(a),y:-7+p.x*Math.sin(a)+p.y*Math.cos(a)};});
  if(!guide.ok)throw new Error('guide');
  const loop={radiusMm:4,forwardStepMm:.5,loopDirection},source='op-trochoid-010f6';
  const before=JSON.stringify({guide:guide.guide,loop,base});
  const r=buildTrochoidalCanonicalToolpath(guide.guide,loop,3,source,base);
  expect(r.ok,`${side} F6: ${r.errors.join(' ')}`);if(!r.ok)continue;
  const t=r.toolpath;
  expect(t.version===1&&t.operationKind==='contour'&&t.strategy==='contour','canonical identity');
  expect(t.tool.diameterMm===6&&t.stepoverPercent===0,'tool metadata');
  expect(t.sourceOperationId===source,'stable source id');
  expect(JSON.stringify(t.runs.map(run=>run.z))===JSON.stringify([-1,-2,-2.4]),'exact run depths');
  expect(t.runs.length===3&&!!t.motions?.length,'runs and motion authority exist');
  expect(JSON.stringify({guide:guide.guide,loop,base})===before,'inputs immutable');

  for(const run of t.runs){
    expect(run.kind==='cut'&&run.retractAfter===true,'run contract');
    expect(!!run.cutSegments3?.length&&run.points.length===run.cutSegments3!.length+1,'run points derive from cuts');
    expect(run.cutSegments3!.every(s=>s.start.z===run.z&&s.end.z===run.z),'run cuts remain planar at run depth');
    expect(run.entrySegments?.length===1,'one stock-cutting ramp entry per level');
    expect(run.entrySegments![0].start.z===0&&run.entrySegments![0].end.z===run.z,'entry is the F3 ramp');
    const points=[{x:run.cutSegments3![0].start.x,y:run.cutSegments3![0].start.y},
      ...run.cutSegments3!.map(s=>({x:s.end.x,y:s.end.y}))];
    expect(JSON.stringify(points)===JSON.stringify(run.points),'run points are exact derived projection');
  }

  const motionCuts=t.motions!.filter(m=>m.kind!=='rapid3'&&m.start.z===m.end.z&&m.start.z<0);
  const runCuts=t.runs.flatMap(run=>run.cutSegments3??[]);
  expect(JSON.stringify(runCuts)===JSON.stringify(motionCuts),'runs are an exact derived view of motion cuts');
}

const guide=buildTrochoidalContourGuide(shapes[0],{...defaultTrochoidalContourContract,contourId:0,side:'outside'});
if(!guide.ok)throw new Error('guide');
const loop={radiusMm:4,forwardStepMm:.5,loopDirection:'cw' as const};
for(const source of ['', '   ']){
  const r=buildTrochoidalCanonicalToolpath(guide.guide,loop,3,source,base);
  expect(!r.ok&&r.toolpath===null,'blank source rejected');
}
for(const radius of [0,-1,Number.NaN]){
  const r=buildTrochoidalCanonicalToolpath(guide.guide,loop,radius,'op',base);
  expect(!r.ok&&r.toolpath===null,'invalid cutter rejected');
}
const inherited=buildTrochoidalCanonicalToolpath(guide.guide,loop,3,'op',{...base,safeZMm:0});
expect(!inherited.ok&&inherited.toolpath===null,'F5/F4 failure remains atomic');
console.log('010-F6 canonical toolpath package: PASS');
